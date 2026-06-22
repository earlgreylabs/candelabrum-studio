import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "wavespeed";
import { z } from "zod";
import type { PayloadObserver, VideoArtifact, VideoProvider } from "@/core/providers";
import type { ShotSpec } from "@/core/run";

const ESTIMATED_COST_USD = 0.5; // Kling I2V cost estimate
const DEFAULT_BASE_URL = "https://api.wavespeed.ai";

const submitResultSchema = z.object({
  code: z.number(),
  data: z.object({ id: z.string().min(1) }),
});

const pollResultSchema = z.object({
  data: z.object({
    status: z.string(),
    outputs: z.union([z.string(), z.array(z.string())]).optional(),
    error: z.string().optional(),
  }),
});

function firstOutput(outputs: string | string[] | undefined): string | undefined {
  return Array.isArray(outputs) ? outputs[0] : outputs;
}

export class WaveSpeedVideoProvider implements VideoProvider {
  private readonly client: Client;

  constructor(
    private readonly apiKey: string,
    private readonly model = "kwaivgi/kling-v1.6-i2v-standard",
    private readonly baseUrl = DEFAULT_BASE_URL,
  ) {
    this.client = new Client(apiKey);
  }

  async animate(
    runId: string,
    renderDir: string,
    spec: ShotSpec,
    baseImagePath: string,
    onPayload?: PayloadObserver,
    existingJobId?: string,
    onJobId?: (jobId: string) => Promise<void>,
  ): Promise<VideoArtifact> {
    await mkdir(renderDir, { recursive: true });

    let operationId = existingJobId;
    let payload: unknown;

    if (!operationId) {
      console.log(`[wavespeed video] Uploading base image from ${baseImagePath}...`);
      const uploadedUrl = await this.client.upload(baseImagePath);
      if (!uploadedUrl || typeof uploadedUrl !== "string") {
        throw new Error(`WaveSpeed upload failed: did not return a valid URL`);
      }

      console.log(`[wavespeed video] Animating run ${runId} with ${this.model}...`);
      payload = {
        model: this.model,
        prompt: spec.motionPrompt,
        image: uploadedUrl,
      };
      onPayload?.(payload);

      const submitRes = await fetch(`${this.baseUrl}/api/v3/${this.model}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!submitRes.ok) {
        throw new Error(`WaveSpeed submit failed: ${await submitRes.text()}`);
      }

      const submitData = submitResultSchema.safeParse(await submitRes.json());
      if (!submitData.success || submitData.data.code !== 0) {
        throw new Error(`WaveSpeed submit returned an invalid response: ${submitData.error}`);
      }

      operationId = submitData.data.data.id;
      if (onJobId) {
        await onJobId(operationId);
      }
    } else {
      console.log(
        `[wavespeed video] Resuming existing animation job ${operationId} for run ${runId}...`,
      );
    }

    if (!operationId) {
      throw new Error("No operation ID found for WaveSpeed video generation");
    }

    // Polling loop
    let videoUrl = "";
    for (let attempt = 0; attempt < 120; attempt++) {
      await Bun.sleep(5000);
      const pollRes = await fetch(`${this.baseUrl}/api/v3/predictions/${operationId}/result`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!pollRes.ok) {
        throw new Error(`WaveSpeed poll failed: ${await pollRes.text()}`);
      }

      const pollData = pollResultSchema.safeParse(await pollRes.json());
      if (!pollData.success) {
        throw new Error(`WaveSpeed poll returned an invalid response: ${pollData.error}`);
      }
      const { data } = pollData.data;

      if (data.status === "completed") {
        videoUrl = firstOutput(data.outputs) ?? "";
        console.log(`[wavespeed video] generation complete for run ${runId}`);
        break;
      }

      if (data.status === "failed") {
        throw new Error(`WaveSpeed generation failed: ${data.error || "Unknown error"}`);
      }

      console.log(`[wavespeed video] still rendering run ${runId} (poll ${attempt + 1})...`);
    }

    if (!videoUrl || typeof videoUrl !== "string") {
      throw new Error(`WaveSpeed API did not return a valid video URL`);
    }

    console.log(`[wavespeed video] Downloading generated video from ${videoUrl}...`);
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to download video from WaveSpeed: ${videoRes.statusText}`);
    }

    const arrayBuffer = await videoRes.arrayBuffer();
    const destPath = resolve(renderDir, `${runId}.mp4`);
    await Bun.write(destPath, new Uint8Array(arrayBuffer));
    console.log(`[wavespeed video] Saved raw clip to ${destPath}`);

    return {
      path: destPath,
      provider: "wavespeed",
      model: this.model,
      costUsd: ESTIMATED_COST_USD,
      payload,
    };
  }
}
