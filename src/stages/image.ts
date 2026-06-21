import { resolve } from "node:path";
import type { Stage } from "@/core/pipeline";

export const image: Stage = async (run, ctx) => {
  if (!run.shotSpec) {
    throw new Error(`run ${run.id} has no shot spec`);
  }

  const runDir = resolve(ctx.settings.paths.runs, run.id);
  const artifact = await ctx.image.generate(run.id, runDir, run.shotSpec);

  run.artifacts.image = artifact.path;
  if (artifact.seed !== undefined) {
    run.shotSpec.seedHint = artifact.seed;
  }
  run.cost.push({
    stage: "image",
    provider: artifact.provider,
    model: artifact.model,
    amountUsd: artifact.costUsd,
    payload: artifact.payload,
  });
};
