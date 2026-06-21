import { mkdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import type { Orientation } from "@/core/constants";
import type { VideoArtifact, VideoProvider } from "@/core/providers";
import type { ShotSpec } from "@/core/run";

// Veo bills per second of generated video; a single clip runs into dollars. Rough
// estimate for the cost ledger — the real figure shows on Google billing.
const ESTIMATED_COST_USD = 1.2;

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_POLL_MS = 10_000;
const MAX_POLLS = 60; // ~10 min ceiling

const ASPECT_RATIO: Record<Orientation, "9:16" | "16:9"> = {
  portrait: "9:16",
  landscape: "16:9",
};

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

export interface VeoProviderOptions {
  fetch?: typeof fetch;
  baseUrl?: string;
  pollMs?: number;
}

interface VeoOperation {
  done?: boolean;
  error?: { message?: string };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: Array<{ video?: { uri?: string; bytesBase64Encoded?: string } }>;
    };
  };
}

/**
 * Automated animate stage via Google Veo (image-to-video). Calls the Gemini API
 * `:predictLongRunning` endpoint directly: @ai-sdk/google's video model sends the
 * base image as `inlineData`, which Veo rejects, so we issue the request ourselves
 * with `image.bytesBase64Encoded` and poll the long-running operation. Same
 * `VideoProvider` interface; key from a gitignored .env (`GEMINI_API_KEY`). `fetch`
 * is injectable for tests (no network, no spend).
 */
export class VeoVideoProvider implements VideoProvider {
  private readonly fetch: typeof fetch;
  private readonly baseUrl: string;
  private readonly pollMs: number;

  constructor(
    private readonly modelId: string,
    private readonly apiKey: string,
    options: VeoProviderOptions = {},
  ) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.pollMs = options.pollMs ?? DEFAULT_POLL_MS;
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

    let operationName = existingJobId;
    let payload: any = undefined;

    if (!operationName) {
      console.log(`[veo] Animating base image for run ${runId} with ${this.modelId}...`);
      const imageBytes = await readFile(baseImagePath);
      const mimeType = MIME_BY_EXT[extname(baseImagePath).toLowerCase()] ?? "image/png";
      const base64 = imageBytes.toString("base64");

      payload = {
        model: `${this.baseUrl}/models/${this.modelId}:predictLongRunning`,
        body: {
          instances: [
            {
              prompt: spec.motionPrompt,
              image: { bytesBase64Encoded: "<base64_omitted>", mimeType },
            },
          ],
          parameters: { aspectRatio: ASPECT_RATIO[spec.orientation], sampleCount: 1 },
        },
      };
      onPayload?.(payload);

      operationName = await this.startGeneration(spec, base64, mimeType);
      if (onJobId) {
        await onJobId(operationName);
      }
    } else {
      console.log(`[veo] Resuming existing animation job ${operationName} for run ${runId}...`);
    }

    const videoBytes = await this.awaitVideo(operationName, runId);

    const destPath = resolve(renderDir, `${runId}.mp4`);
    await Bun.write(destPath, videoBytes);
    console.log(`[veo] Saved raw clip to ${destPath}`);

    return {
      path: destPath,
      provider: "veo",
      model: this.modelId,
      costUsd: ESTIMATED_COST_USD,
      payload,
    };
  }

  private async startGeneration(spec: ShotSpec, base64: string, mimeType: string): Promise<string> {
    const res = await this.fetch(`${this.baseUrl}/models/${this.modelId}:predictLongRunning`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        instances: [{ prompt: spec.motionPrompt, image: { bytesBase64Encoded: base64, mimeType } }],
        parameters: { aspectRatio: ASPECT_RATIO[spec.orientation], sampleCount: 1 },
      }),
    });
    if (!res.ok) {
      throw new Error(`[veo] predictLongRunning failed (${res.status}): ${await res.text()}`);
    }
    const { name } = (await res.json()) as { name?: string };
    if (!name) {
      throw new Error("[veo] no operation name returned");
    }
    return name;
  }

  private async awaitVideo(operationName: string, runId: string): Promise<Uint8Array> {
    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      await Bun.sleep(this.pollMs);
      const res = await this.fetch(`${this.baseUrl}/${operationName}`, {
        headers: { "x-goog-api-key": this.apiKey },
      });
      if (!res.ok) {
        throw new Error(`[veo] operation poll failed (${res.status}): ${await res.text()}`);
      }
      const op = (await res.json()) as VeoOperation;
      if (op.error) {
        throw new Error(`[veo] generation failed: ${op.error.message ?? "unknown error"}`);
      }
      if (op.done) {
        console.log(`[veo] generation complete for run ${runId}`);
        return this.downloadVideo(op);
      }
      console.log(`[veo] still rendering run ${runId} (poll ${attempt + 1})...`);
    }
    throw new Error(`[veo] timed out waiting for ${operationName}`);
  }

  private async downloadVideo(op: VeoOperation): Promise<Uint8Array> {
    const video = op.response?.generateVideoResponse?.generatedSamples?.[0]?.video;
    if (video?.bytesBase64Encoded) {
      return Buffer.from(video.bytesBase64Encoded, "base64");
    }
    if (video?.uri) {
      const res = await this.fetch(video.uri, { headers: { "x-goog-api-key": this.apiKey } });
      if (!res.ok) {
        throw new Error(`[veo] video download failed (${res.status})`);
      }
      return new Uint8Array(await res.arrayBuffer());
    }
    throw new Error(
      `[veo] operation done but no video in response: ${JSON.stringify(op.response)}`,
    );
  }
}
