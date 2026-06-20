/**
 * Slice-1 stage stubs. Each writes a placeholder artifact and records zero cost,
 * exercising the run model, the store, and resume end to end. Real provider and
 * subprocess implementations replace these one stage at a time in later slices,
 * behind the same adapter interfaces (see docs/concept/02-architecture.md).
 */

import { resolve } from "node:path";
import type { Stage } from "@/core/pipeline";
import type { RunStatus } from "@/core/run";

const STUB_SUBJECT = "lone vessel adrift past a luminous nebula";

function fill(scaffold: string, subject: string): string {
  return scaffold.replaceAll("{subject}", subject);
}

const direct: Stage = async (run, ctx) => {
  const prompt = ctx.style?.prompt;
  run.shotSpec = {
    imagePrompt: prompt ? fill(prompt.imageScaffold, STUB_SUBJECT) : `A ${STUB_SUBJECT}`,
    motionPrompt: prompt ? fill(prompt.motionScaffold, STUB_SUBJECT) : "slow forward camera push",
    captionDraft: "Drifting through the deep.",
    style: run.style ?? ctx.style?.id ?? "none",
    orientation: run.profile.orientation,
  };
  run.cost.push({ stage: "direct", provider: ctx.settings.providers.director, amountUsd: 0 });
};

const image: Stage = async (run, ctx) => {
  const path = resolve(ctx.settings.paths.runs, run.id, "image.placeholder.png");
  await Bun.write(path, `stub base image for ${run.id}`);
  run.artifacts.image = path;
  run.cost.push({ stage: "image", provider: ctx.settings.providers.image, amountUsd: 0 });
};

const animate: Stage = async (run, ctx) => {
  const path = resolve(ctx.settings.paths.renders, "raw", `${run.id}.placeholder.mp4`);
  await Bun.write(path, `stub raw clip for ${run.id}`);
  run.artifacts.rawClip = path;
  run.cost.push({ stage: "animate", provider: ctx.settings.providers.video, amountUsd: 0 });
};

const interpolate: Stage = async (run, ctx) => {
  const path = resolve(ctx.settings.paths.renders, "master", `${run.id}.placeholder.mov`);
  await Bun.write(path, `stub flat ProRes master for ${run.id}`);
  run.artifacts.masterClip = path;
  run.cost.push({ stage: "interpolate", provider: "rife-ncnn-vulkan", amountUsd: 0 });
};

const caption: Stage = async (run, ctx) => {
  if (run.shotSpec) {
    run.shotSpec.captionDraft = `${run.shotSpec.captionDraft} #scifi #spaceart #aiart`;
  }
  run.cost.push({ stage: "caption", provider: ctx.settings.providers.director, amountUsd: 0 });
};

const exportPackage: Stage = async (run, ctx) => {
  const dir = resolve(ctx.settings.paths.ready, run.id);
  await Bun.write(resolve(dir, "caption.txt"), run.shotSpec?.captionDraft ?? "");
  await Bun.write(
    resolve(dir, "manifest.json"),
    JSON.stringify({ id: run.id, profile: run.profile }, null, 2),
  );
  run.artifacts.exportPackage = dir;
  run.cost.push({ stage: "export", provider: "ffmpeg", amountUsd: 0 });
};

/** The stage handler for each non-gate, non-terminal status. */
export const STAGES: Partial<Record<RunStatus, Stage>> = {
  directing: direct,
  imaging: image,
  animating: animate,
  interpolating: interpolate,
  captioning: caption,
  exporting: exportPackage,
};
