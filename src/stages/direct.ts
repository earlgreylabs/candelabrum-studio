/**
 * Stage 1: the creative director proposes concepts and finalises a shot spec.
 * Headless runs pick the first concept and advance to Gate A; the human revise
 * loop ("more synthwave purple") lives in the dashboard, not here.
 */

import type { Stage } from "@/core/pipeline";

const CONCEPT_COUNT = 3;

export const direct: Stage = async (run, ctx) => {
  let proposePayload: any = undefined;
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
  run.concept = chosen;
  run.cost.push({
    stage: "direct",
    provider: ctx.settings.providers.director,
    model: ctx.director.modelId,
    amountUsd: 0,
    payload: proposePayload,
  });
};
