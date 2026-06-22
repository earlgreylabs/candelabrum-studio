import type { Stage } from "@/core/pipeline";

export const exportPackage: Stage = async (run, ctx) => {
  if (!run.shotSpec) {
    throw new Error(`run ${run.id} has no shot spec`);
  }
  if (!run.artifacts.masterClip) {
    throw new Error(`run ${run.id} has no master clip to export`);
  }
  if (run.artifacts.exportPackage && run.artifacts.exportVideo) {
    if (await Bun.file(run.artifacts.exportVideo).exists()) {
      ctx.log(`[Export] Reusing persisted package for run ${run.id}.`);
      return;
    }
  }

  const pkg = await ctx.export.package(run, ctx.settings.paths.ready);

  run.artifacts.exportPackage = pkg.dir;
  run.artifacts.exportVideo = pkg.video;
  run.cost.push({ stage: "export", provider: "ffmpeg", model: "ffmpeg", amountUsd: 0 });
};
