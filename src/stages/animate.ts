import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Stage } from "@/core/pipeline";

export const animate: Stage = async (run, ctx) => {
  if (!run.shotSpec) {
    throw new Error(`run ${run.id} has no shot spec`);
  }
  if (!run.artifacts.image) {
    throw new Error(`run ${run.id} has no base image artifact`);
  }

  const rendersRawDir = resolve(ctx.settings.paths.renders, "raw");
  await mkdir(rendersRawDir, { recursive: true });

  const artifact = await ctx.video.animate(
    run.id,
    rendersRawDir,
    run.shotSpec,
    run.artifacts.image,
  );

  run.artifacts.rawClip = artifact.path;
  run.cost.push({
    stage: "animate",
    provider: artifact.provider,
    model: artifact.model,
    amountUsd: artifact.costUsd,
  });
};
