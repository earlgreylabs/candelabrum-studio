import type { Stage } from "@/core/pipeline";

export const exportPackage: Stage = async (run, ctx) => {
  if (!run.shotSpec) {
    throw new Error(`run ${run.id} has no shot spec`);
  }
  if (!run.artifacts.masterClip) {
    throw new Error(`run ${run.id} has no master clip to export`);
  }

  const pkg = await ctx.export.package(
    run.id,
    ctx.settings.paths.ready,
    run.shotSpec,
    run.artifacts.masterClip,
  );

  run.artifacts.exportPackage = pkg.dir;
  run.cost.push({ stage: "export", provider: "ffmpeg", amountUsd: 0 });
};
