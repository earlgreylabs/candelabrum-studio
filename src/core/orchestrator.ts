/**
 * The orchestrator advances a run through the pipeline, persisting after every
 * stage transition so a crash resumes rather than restarts. It owns all status
 * transitions; stages only produce artifacts. Resume is not a special mode: it is
 * `store.load(id)` followed by `advance`, driven entirely by the run's `status`.
 */

import type { PipelineContext } from "@/core/pipeline";
import { isGate, isTerminal, NEXT_STATUS, type Run, transition } from "@/core/run";
import { STAGES } from "@/stages/stubs";

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
  return run;
}

/** Pass the current gate, then advance to the next gate or terminal state. */
export async function approve(run: Run, ctx: PipelineContext, note?: string): Promise<Run> {
  if (!isGate(run.status)) {
    throw new Error(`run ${run.id} is not at a gate (status: ${run.status})`);
  }
  const next = NEXT_STATUS[run.status];
  if (!next) {
    throw new Error(`no transition defined from gate: ${run.status}`);
  }
  transition(run, next, "operator", note ?? "approved");
  await ctx.store.save(run);
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
