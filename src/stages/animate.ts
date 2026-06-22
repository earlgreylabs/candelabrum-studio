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
  if (run.artifacts.rawClip && (await Bun.file(run.artifacts.rawClip).exists())) {
    ctx.log(`[Animate] Reusing persisted raw clip for run ${run.id}.`);
    return;
  }

  const rendersRawDir = resolve(ctx.settings.paths.renders, "raw");
  await mkdir(rendersRawDir, { recursive: true });

  const sourceImage = run.artifacts.upscaledImage ?? run.artifacts.image;

  const artifact = await ctx.video.animate(
    run.id,
    rendersRawDir,
    run.shotSpec,
    sourceImage,
    undefined,
    run.artifacts.providerJobId,
    async (jobId) => {
      run.artifacts.providerJobId = jobId;
      await ctx.store.save(run);
    },
  );

  run.artifacts.providerJobId = undefined; // clear it once completed successfully
  run.artifacts.rawClip = artifact.path;
  run.cost.push({
    stage: "animate",
    provider: artifact.provider,
    model: artifact.model,
    amountUsd: artifact.costUsd,
    payload: artifact.payload,
  });
};
