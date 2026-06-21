import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { generateImage, type ImageModel } from "ai";
import type { Orientation } from "@/core/constants";
import type { ImageArtifact, ImageProvider } from "@/core/providers";
import type { ShotSpec } from "@/core/run";
import { modelIdOf } from "@/providers/model-id";

// FLUX is billed per megapixel and a 9:16 frame is ~2 MP; this is a rough
// estimate for cost tracking, since fal (via the AI SDK) does not return actual
// billing in the response. See docs/concept/06-economics-and-monetization.md.
const ESTIMATED_COST_USD = 0.06;

const ASPECT_RATIO: Record<Orientation, `${number}:${number}`> = {
  portrait: "9:16",
  landscape: "16:9",
};

/**
 * Automated image stage: generates the base still with FLUX on fal via the
 * Vercel AI SDK. Satisfies the same `ImageProvider` interface as the manual
 * inbox, so enabling it is a config swap (`image = "fal"`), not a pipeline
 * change. The model is injected (mockable, no spend); the API key is read lazily
 * by the AI SDK from a gitignored .env (`FAL_KEY`).
 */
export class FalImageProvider implements ImageProvider {
  constructor(private readonly model: ImageModel) {}

  async generate(
    runId: string,
    runDir: string,
    spec: ShotSpec,
    onPayload?: (payload: any) => void,
  ): Promise<ImageArtifact> {
    await mkdir(runDir, { recursive: true });
    console.log(`[fal] Generating base image for run ${runId}...`);

    const payload = {
      model: modelIdOf(this.model),
      prompt: spec.imagePrompt,
      aspectRatio: ASPECT_RATIO[spec.orientation],
      ...(spec.seedHint !== undefined ? { seed: spec.seedHint } : {}),
    };
    onPayload?.(payload);

    const { image } = await generateImage({
      ...payload,
      model: this.model,
    });

    const ext = image.mediaType === "image/jpeg" ? ".jpg" : ".png";
    const destPath = resolve(runDir, `image.base${ext}`);
    await Bun.write(destPath, image.uint8Array);
    console.log(`[fal] Saved base image to ${destPath}`);

    return {
      path: destPath,
      seed: spec.seedHint,
      provider: "fal",
      model: modelIdOf(this.model),
      costUsd: ESTIMATED_COST_USD,
      payload,
    };
  }
}
