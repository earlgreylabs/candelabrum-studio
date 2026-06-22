import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "wavespeed";
import { z } from "zod";
import type { Orientation } from "@/core/constants";
import type { ImageArtifact, ImageProvider, PayloadObserver } from "@/core/providers";
import type { ShotSpec } from "@/core/run";

const ESTIMATED_COST_USD = 0.03;

const ASPECT_RATIO: Record<Orientation, string> = {
  portrait: "9:16",
  landscape: "16:9",
};

const waveSpeedImageResultSchema = z.object({
  outputs: z.union([z.string(), z.array(z.string())]),
});

function firstOutput(outputs: string | string[]): string | undefined {
  return Array.isArray(outputs) ? outputs[0] : outputs;
}

export class WaveSpeedImageProvider implements ImageProvider {
  private client: Client;

  constructor(apiKey: string) {
    this.client = new Client(apiKey);
  }

  async generate(
    runId: string,
    runDir: string,
    spec: ShotSpec,
    onPayload?: PayloadObserver,
  ): Promise<ImageArtifact> {
    await mkdir(runDir, { recursive: true });
    console.log(`[wavespeed] Generating base image for run ${runId}...`);

    const payload = {
      model: "wavespeed-ai/flux-dev",
      prompt: spec.imagePrompt,
      aspect_ratio: ASPECT_RATIO[spec.orientation],
      seed: spec.seedHint,
    };
    onPayload?.(payload);

    const result = await this.client.run(
      "wavespeed-ai/flux-dev",
      {
        prompt: spec.imagePrompt,
        aspect_ratio: ASPECT_RATIO[spec.orientation],
        seed: spec.seedHint,
      },
      {
        enableSyncMode: true,
      },
    );

    const parsed = waveSpeedImageResultSchema.safeParse(result);
    const imageUrl = parsed.success ? firstOutput(parsed.data.outputs) : undefined;
    if (!imageUrl) {
      throw new Error(`WaveSpeed API did not return a valid image URL: ${JSON.stringify(result)}`);
    }

    console.log(`[wavespeed] Downloading generated image from ${imageUrl}...`);
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to download image from WaveSpeed: ${imageRes.statusText}`);
    }

    const arrayBuffer = await imageRes.arrayBuffer();
    const destPath = resolve(runDir, `image.base.png`);
    await Bun.write(destPath, new Uint8Array(arrayBuffer));
    console.log(`[wavespeed] Saved base image to ${destPath}`);

    return {
      path: destPath,
      seed: spec.seedHint,
      provider: "wavespeed",
      model: "wavespeed-ai/flux-dev",
      costUsd: ESTIMATED_COST_USD,
      payload,
    };
  }
}
