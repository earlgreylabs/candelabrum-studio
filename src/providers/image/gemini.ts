import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { generateText, type LanguageModel } from "ai";
import type { Orientation } from "@/core/constants";
import type { ImageArtifact, ImageProvider } from "@/core/providers";
import type { ShotSpec } from "@/core/run";
import { modelIdOf } from "@/providers/model-id";

// Gemini image models bill per output token (~1290 tokens per image); this is a
// rough estimate for cost tracking, since exact billing is not returned in the
// response. See docs/concept/06-economics-and-monetization.md.
const ESTIMATED_COST_USD = 0.04;

const ASPECT_RATIO: Record<Orientation, "9:16" | "16:9"> = {
  portrait: "9:16",
  landscape: "16:9",
};

/**
 * Automated image stage via Google's "Nano Banana" Gemini image models (e.g.
 * gemini-3.1-flash-image), through the Vercel AI SDK. Gemini returns the image
 * as a file on a multimodal `generateText` response — not the `generateImage`
 * path fal uses. Same `ImageProvider` interface, so enabling it is a config swap
 * (`image = "gemini"`). The model is injected (mockable, no spend); the API key
 * comes from a gitignored .env (`GEMINI_API_KEY`), wired in the factory.
 */
export class GeminiImageProvider implements ImageProvider {
  constructor(private readonly model: LanguageModel) {}

  async generate(runId: string, runDir: string, spec: ShotSpec): Promise<ImageArtifact> {
    await mkdir(runDir, { recursive: true });
    console.log(`[gemini] Generating base image for run ${runId}...`);

    const { files } = await generateText({
      model: this.model,
      prompt: spec.imagePrompt,
      providerOptions: {
        google: { imageConfig: { aspectRatio: ASPECT_RATIO[spec.orientation] } },
      },
    });

    const imageFile = files.find((file) => file.mediaType.startsWith("image/"));
    if (!imageFile) {
      throw new Error(`[gemini] model returned no image for run ${runId}`);
    }

    const ext = imageFile.mediaType === "image/jpeg" ? ".jpg" : ".png";
    const destPath = resolve(runDir, `image.base${ext}`);
    await Bun.write(destPath, imageFile.uint8Array);
    console.log(`[gemini] Saved base image to ${destPath}`);

    return {
      path: destPath,
      seed: spec.seedHint,
      provider: "gemini",
      model: modelIdOf(this.model),
      costUsd: ESTIMATED_COST_USD,
    };
  }
}
