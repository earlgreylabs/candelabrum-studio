/**
 * The orchestrator advances a run through the pipeline, persisting after every
 * stage transition so a crash resumes rather than restarts. It owns all status
 * transitions; stages only produce artifacts. Resume is not a special mode: it is
 * `store.load(id)` followed by `advance`, driven entirely by the run's `status`.
 */

import type { PipelineContext } from "@/core/pipeline";
import { selectedProvider } from "@/core/provider-selection";
import { clearRunFailure, isGate, isTerminal, NEXT_STATUS, type Run, transition } from "@/core/run";
import { STAGES } from "@/stages";

/**
 * Run stages until the run reaches a gate (awaiting the operator) or a terminal
 * state. Idempotent at a gate or terminal state, so it is safe to call on resume.
 */
export async function advance(run: Run, ctx: PipelineContext): Promise<Run> {
  while (!isGate(run.status) && !isTerminal(run.status)) {
    const from = run.status;
    const previousFailure = run.lastError;
    const stage = ctx.stages?.[from] ?? STAGES[from];
    if (!stage) {
      throw new Error(`no stage handler for status: ${from}`);
    }
    const next = NEXT_STATUS[from];
    if (!next) {
      throw new Error(`no transition defined from status: ${from}`);
    }
    ctx.log(`▶ ${from}`);
    await stage(run, ctx);
    clearRunFailure(run);
    transition(run, next, "stage");

    if (next === "ready" && run.artifacts.exportPackage) {
      try {
        await ctx.export.finalize(run, run.artifacts.exportPackage);
      } catch (error) {
        run.status = from;
        run.lastError = previousFailure;
        run.events.pop();
        throw error;
      }
    }

    await ctx.store.save(run);
  }

  if (isGate(run.status)) {
    ctx.notify("Action Required", `Run ${run.id} is waiting at ${run.status.replace("_", " ")}`);
  }

  return run;
}

/**
 * Pass the current gate into the next (pre-stage) status and persist, without
 * running the next stage. Callers that must not block on a long-running stage
 * (e.g. the dashboard API, where a stage may be a `ManualInbox` awaiting a file
 * drop) use this, then drive `advance` separately in the background.
 */
export async function passGate(
  run: Run,
  ctx: PipelineContext,
  note?: string,
  caption?: string,
): Promise<Run> {
  if (!isGate(run.status)) {
    throw new Error(`run ${run.id} is not at a gate (status: ${run.status})`);
  }

  // If we are at Gate B, we can optionally override the caption draft
  if (run.status === "gate_b" && caption !== undefined && run.shotSpec) {
    run.shotSpec.captionDraft = caption;
  }

  // If we are at Gate A, finalise the concept into a shot spec before proceeding
  if (run.status === "gate_a") {
    if (!run.concept) {
      throw new Error(`run ${run.id} has no concept to finalise at gate_a`);
    }
    let finalisePayload: unknown;
    run.shotSpec = await ctx.director.finalise(
      run.concept,
      run.profile.orientation,
      ctx.style,
      (payload) => {
        finalisePayload = payload;
      },
    );
    // Concept is no longer needed after finalisation
    run.concept = undefined;
    // "Refine text": the director turns the concept into the shot spec prompts.
    run.cost.push({
      stage: "finalise",
      provider: selectedProvider(run.providerSelections, ctx.settings, "finalise"),
      model: ctx.director.modelId,
      amountUsd: 0,
      payload: finalisePayload,
    });
  }

  const next = NEXT_STATUS[run.status];
  if (!next) {
    throw new Error(`no transition defined from gate: ${run.status}`);
  }
  transition(run, next, "operator", note ?? "approved");
  await ctx.store.save(run);
  return run;
}

/** Pass the current gate, then advance to the next gate or terminal state. */
export async function approve(
  run: Run,
  ctx: PipelineContext,
  note?: string,
  caption?: string,
): Promise<Run> {
  await passGate(run, ctx, note, caption);
  return advance(run, ctx);
}

/** Revise the concept at Gate A based on an instruction. */
export async function revise(run: Run, ctx: PipelineContext, instruction: string): Promise<Run> {
  if (run.status !== "gate_a") {
    throw new Error(`revise is only valid at gate_a, but run is at ${run.status}`);
  }
  if (!run.concept) {
    throw new Error(`run ${run.id} has no concept to revise`);
  }

  ctx.log(`Revise concept: ${instruction}`);
  let revisePayload: unknown;
  run.concept = await ctx.director.revise(run.concept, instruction, (payload) => {
    revisePayload = payload;
  });
  run.events.push({
    at: new Date().toISOString(),
    type: "operator",
    note: `revised concept: ${instruction}`,
  });
  run.cost.push({
    stage: "revise",
    provider: selectedProvider(run.providerSelections, ctx.settings, "revision"),
    model: ctx.director.modelId,
    amountUsd: 0,
    payload: revisePayload,
  });

  await ctx.store.save(run);
  return run;
}

/**
 * Clear artifacts and step backward to retry generation, persisting without
 * running the retried stage. Like `passGate`, this lets the API return before a
 * potentially blocking stage runs; the caller drives `advance` separately.
 */
export async function prepRegenerate(run: Run, ctx: PipelineContext): Promise<Run> {
  const statusHandlers: { [key: string]: () => void } = {
    gate_a5: () => {
      // Re-roll image
      run.artifacts.image = undefined;
      run.artifacts.upscaledImage = undefined;
      transition(run, "imaging", "operator", "regenerate image");
    },
    gate_b: () => {
      // Re-roll video
      run.artifacts.rawClip = undefined;
      run.artifacts.masterClip = undefined;
      run.artifacts.masterProxyClip = undefined;
      run.artifacts.masterMode = undefined;
      run.artifacts.masterNote = undefined;
      run.artifacts.providerJobId = undefined;
      transition(run, "animating", "operator", "regenerate video");
    },
  };

  const handler = statusHandlers[run.status];
  if (handler) {
    handler();
  } else {
    throw new Error(`regenerate is only valid at gate_a5 or gate_b, but run is at ${run.status}`);
  }

  await ctx.store.save(run);
  return run;
}

/** Step backward to retry generation, then advance through the retried stage. */
export async function regenerate(run: Run, ctx: PipelineContext): Promise<Run> {
  await prepRegenerate(run, ctx);
  return advance(run, ctx);
}

/** Discard the run. Valid from any non-terminal state. */
export async function reject(run: Run, ctx: PipelineContext, note?: string): Promise<Run> {
  if (isTerminal(run.status)) {
    throw new Error(`run ${run.id} is already terminal (status: ${run.status})`);
  }
  transition(run, "rejected", "operator", note ?? "rejected");
  await ctx.store.save(run);
  return run;
}

/** Recover a failed run back to its previous status before it failed. */
export async function recover(run: Run, ctx: PipelineContext): Promise<Run> {
  if (run.status !== "failed") {
    throw new Error(`run ${run.id} is not failed (status: ${run.status})`);
  }
  // Find the last event where it transitioned to "failed"
  const failEvent = run.events[run.events.length - 1];
  if (failEvent?.to !== "failed" || !failEvent.from) {
    throw new Error(`cannot determine previous status before failure for run ${run.id}`);
  }

  transition(run, failEvent.from, "operator", "recovered from failure");
  await ctx.store.save(run);
  return run;
}
