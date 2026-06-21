import type { Stage } from "@/core/pipeline";

export const caption: Stage = async (run, ctx) => {
  if (!run.shotSpec) {
    throw new Error(`run ${run.id} has no shot spec`);
  }

  // The director adapter implements the platform caption logic.
  // We use tiktok as the default target platform for now.
  const platform = "tiktok";
  const finalCaption = await ctx.director.caption(run.shotSpec, platform);

  run.shotSpec.captionDraft = finalCaption;
  run.cost.push({ stage: "caption", provider: ctx.settings.providers.director, amountUsd: 0 });
};
