import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "wavespeed";
import type { Orientation } from "@/core/constants";
import type { ImageArtifact, ImageProvider } from "@/core/providers";
import type { ShotSpec } from "@/core/run";

const ESTIMATED_COST_USD = 0.03;

const ASPECT_RATIO: Record<Orientation, string> = {
  portrait: "9:16",
  landscape: "16:9",
};

export class WaveSpeedImageProvider implements ImageProvider {
  private client: Client;

  constructor(apiKey: string) {
    this.client = new Client(apiKey);
  }

  async generate(
    runId: string,
    runDir: string,
    spec: ShotSpec,
    onPayload?: (payload: any) => void,
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

    const output = (await this.client.run(
      "wavespeed-ai/flux-dev",
      {
        prompt: spec.imagePrompt,
        aspect_ratio: ASPECT_RATIO[spec.orientation],
        seed: spec.seedHint,
      },
      {
        enableSyncMode: true,
      },
    )) as any;

    const imageUrl = output?.outputs?.[0] || output?.outputs;
    if (!imageUrl || typeof imageUrl !== "string") {
      throw new Error(`WaveSpeed API did not return a valid image URL: ${JSON.stringify(output)}`);
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
