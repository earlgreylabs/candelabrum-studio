/**
 * Stage 1: the creative director proposes concepts and finalises a shot spec.
 * Headless runs pick the first concept and advance to Gate A; the human revise
 * loop ("more synthwave purple") lives in the dashboard, not here.
 */

import type { Stage } from "@/core/pipeline";
import { selectedProvider } from "@/core/provider-selection";

// Request a single concept and lean on prompt technique (internal divergent
// thinking plus an explicit quality bar) rather than sampling several and
// discarding all but the first.
const CONCEPT_COUNT = 1;

export const direct: Stage = async (run, ctx) => {
  if (run.concept) {
    ctx.log(`[Direct] Reusing persisted concept for run ${run.id}.`);
    return;
  }

  let proposePayload: unknown;
  const concepts = await ctx.director.proposeConcepts(
    {
      count: CONCEPT_COUNT,
      style: ctx.style,
      lore: run.lore,
    },
    (payload) => {
      proposePayload = payload;
    },
  );
  const chosen = concepts[0];
  if (!chosen) {
    throw new Error("director proposed no concepts");
  }
  // The rationale is the director's chain-of-thought. Keep it in the breakdown
  // payload (viewable via the "P" inspector) but strip it from the stored concept
  // so it does not flow into later prompts (finalise/revise) or the concept panel.
  const { rationale, ...concept } = chosen;
  run.concept = concept;
  run.cost.push({
    stage: "direct",
    provider: selectedProvider(run.providerSelections, ctx.settings, "concept"),
    model: ctx.director.modelId,
    amountUsd: 0,
    payload: { request: proposePayload, response: chosen },
  });
};
