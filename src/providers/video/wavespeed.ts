import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "wavespeed";
import type { VideoArtifact, VideoProvider } from "@/core/providers";
import type { ShotSpec } from "@/core/run";

const ESTIMATED_COST_USD = 0.5; // Kling I2V cost estimate

export class WaveSpeedVideoProvider implements VideoProvider {
  private client: Client;
  private model: string;

  constructor(apiKey: string, modelId: string = "kwaivgi/kling-v1.6-i2v-standard") {
    this.client = new Client(apiKey);
    this.model = modelId;
  }

  async animate(
    runId: string,
    renderDir: string,
    spec: ShotSpec,
    baseImagePath: string,
    onPayload?: (payload: any) => void,
    existingJobId?: string,
    onJobId?: (jobId: string) => Promise<void>,
  ): Promise<VideoArtifact> {
    await mkdir(renderDir, { recursive: true });

    let operationId = existingJobId;
    let payload: any = undefined;
    const apiKey = (this.client as any).apiKey;
    const baseUrl = (this.client as any).baseUrl || "https://api.wavespeed.ai";

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

      const submitRes = await fetch(`${baseUrl}/api/v3/${this.model}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!submitRes.ok) {
        throw new Error(`WaveSpeed submit failed: ${await submitRes.text()}`);
      }

      const submitData = (await submitRes.json()) as any;
      if (submitData.code !== 0 || !submitData.data?.id) {
        throw new Error(`WaveSpeed submit failed: ${JSON.stringify(submitData)}`);
      }

      operationId = submitData.data.id;
      if (onJobId && operationId) {
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
      const pollRes = await fetch(`${baseUrl}/api/v3/predictions/${operationId}/result`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!pollRes.ok) {
        throw new Error(`WaveSpeed poll failed: ${await pollRes.text()}`);
      }

      const pollData = (await pollRes.json()) as any;
      const data = pollData.data || {};

      if (data.status === "completed") {
        videoUrl = data.outputs?.[0] || data.outputs;
        console.log(`[wavespeed video] generation complete for run ${runId}`);
        break;
      } else if (data.status === "failed") {
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
