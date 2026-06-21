/**
 * Stage stubs awaiting their real implementations. Each writes a placeholder
 * artifact and records zero cost, so the run model, store, and resume work end
 * to end while real provider and subprocess stages land one at a time (see
 * docs/concept/02-architecture.md). The direct stage is real; see direct.ts.
 */

import { resolve } from "node:path";
import type { Stage } from "@/core/pipeline";

export const interpolate: Stage = async (run, ctx) => {
  const path = resolve(ctx.settings.paths.renders, "master", `${run.id}.placeholder.mov`);
  await Bun.write(path, `stub flat ProRes master for ${run.id}`);
  run.artifacts.masterClip = path;
  run.cost.push({ stage: "interpolate", provider: "rife-ncnn-vulkan", amountUsd: 0 });
};

export const caption: Stage = async (run, ctx) => {
  if (run.shotSpec) {
    run.shotSpec.captionDraft = `${run.shotSpec.captionDraft} #scifi #spaceart #aiart`;
  }
  run.cost.push({ stage: "caption", provider: ctx.settings.providers.director, amountUsd: 0 });
};

export const exportPackage: Stage = async (run, ctx) => {
  const dir = resolve(ctx.settings.paths.ready, run.id);
  await Bun.write(resolve(dir, "caption.txt"), run.shotSpec?.captionDraft ?? "");
  await Bun.write(
    resolve(dir, "manifest.json"),
    JSON.stringify({ id: run.id, profile: run.profile }, null, 2),
  );
  run.artifacts.exportPackage = dir;
  run.cost.push({ stage: "export", provider: "ffmpeg", amountUsd: 0 });
};
