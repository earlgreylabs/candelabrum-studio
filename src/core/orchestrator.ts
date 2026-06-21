/**
 * The orchestrator advances a run through the pipeline, persisting after every
 * stage transition so a crash resumes rather than restarts. It owns all status
 * transitions; stages only produce artifacts. Resume is not a special mode: it is
 * `store.load(id)` followed by `advance`, driven entirely by the run's `status`.
 */

import type { PipelineContext } from "@/core/pipeline";
import { isGate, isTerminal, NEXT_STATUS, type Run, transition } from "@/core/run";
import { STAGES } from "@/stages";

/**
 * Run stages until the run reaches a gate (awaiting the operator) or a terminal
 * state. Idempotent at a gate or terminal state, so it is safe to call on resume.
 */
export async function advance(run: Run, ctx: PipelineContext): Promise<Run> {
  while (!isGate(run.status) && !isTerminal(run.status)) {
    const from = run.status;
    const stage = STAGES[from];
    if (!stage) {
      throw new Error(`no stage handler for status: ${from}`);
    }
    const next = NEXT_STATUS[from];
    if (!next) {
      throw new Error(`no transition defined from status: ${from}`);
    }
    ctx.log(`▶ ${from}`);
    await stage(run, ctx);
    transition(run, next, "stage");
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
  if (run.status === "gate_b" && caption && run.shotSpec) {
    run.shotSpec.captionDraft = caption;
  }

  // If we are at Gate A, finalise the concept into a shot spec before proceeding
  if (run.status === "gate_a") {
    if (!run.concept) {
      throw new Error(`run ${run.id} has no concept to finalise at gate_a`);
    }
    run.shotSpec = await ctx.director.finalise(run.concept, run.profile.orientation, ctx.style);
    // Concept is no longer needed after finalisation
    run.concept = undefined;
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
  run.concept = await ctx.director.revise(run.concept, instruction);
  run.events.push({
    at: new Date().toISOString(),
    type: "operator",
    note: `revised concept: ${instruction}`,
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
  if (run.status === "gate_a5") {
    // Re-roll image
    run.artifacts.image = undefined;
    transition(run, "imaging", "operator", "regenerate image");
  } else if (run.status === "gate_b") {
    // Re-roll video
    run.artifacts.rawClip = undefined;
    run.artifacts.masterClip = undefined;
    transition(run, "animating", "operator", "regenerate video");
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
