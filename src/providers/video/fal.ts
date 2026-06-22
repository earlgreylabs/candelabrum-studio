import { mkdir } from "node:fs/promises";
import { basename, extname, resolve } from "node:path";
import { createFalClient } from "@fal-ai/client";
import { z } from "zod";
import type { Orientation } from "@/core/constants";
import type { PayloadObserver, VideoArtifact, VideoProvider } from "@/core/providers";
import type { ShotSpec } from "@/core/run";

const DEFAULT_POLL_MS = 5_000;
const MAX_POLLS = 240;

const videoResultSchema = z.object({
  video: z.object({ url: z.string().url() }),
});

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export const FAL_VIDEO_MODELS = {
  cosmos: {
    endpoint: "nvidia/cosmos-3-super/image-to-video",
    label: "fal.ai NVIDIA Cosmos 3 Super",
    estimatedCostUsd: 0.4,
  },
  seedance: {
    endpoint: "bytedance/seedance-2.0/image-to-video",
    label: "fal.ai ByteDance Seedance 2.0",
    estimatedCostUsd: 1.52,
  },
  kling: {
    endpoint: "fal-ai/kling-video/v3/turbo/pro/image-to-video",
    label: "fal.ai Kling 3.0 Turbo Pro",
    estimatedCostUsd: 0.7,
  },
} as const;

export type FalVideoModel = keyof typeof FAL_VIDEO_MODELS;

export interface FalVideoClient {
  upload(file: File): Promise<string>;
  submit(endpoint: string, input: Record<string, unknown>): Promise<string>;
  status(endpoint: string, requestId: string): Promise<"IN_QUEUE" | "IN_PROGRESS" | "COMPLETED">;
  result(endpoint: string, requestId: string): Promise<unknown>;
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function createClient(apiKey: string): FalVideoClient {
  const client = createFalClient({ credentials: apiKey });
  return {
    upload: (file) => client.storage.upload(file),
    async submit(endpoint, input) {
      const submission = await client.queue.submit(endpoint, { input });
      return submission.request_id;
    },
    async status(endpoint, requestId) {
      const status = await client.queue.status(endpoint, { requestId, logs: true });
      return status.status;
    },
    async result(endpoint, requestId) {
      const result = await client.queue.result(endpoint, { requestId });
      return result.data;
    },
  };
}

const ASPECT_RATIO: Record<Orientation, "9:16" | "16:9"> = {
  portrait: "9:16",
  landscape: "16:9",
};

function modelInput(
  model: FalVideoModel,
  spec: ShotSpec,
  imageUrl: string,
): Record<string, unknown> {
  const common = { prompt: spec.motionPrompt, image_url: imageUrl };
  if (model === "cosmos") {
    return {
      ...common,
      image_size: spec.orientation === "portrait" ? "portrait_16_9" : "landscape_16_9",
      enable_agentic_generation: false,
    };
  }
  if (model === "seedance") {
    return {
      ...common,
      resolution: "720p",
      duration: 5,
      aspect_ratio: ASPECT_RATIO[spec.orientation],
      generate_audio: false,
      ...(spec.seedHint !== undefined ? { seed: spec.seedHint } : {}),
    };
  }
  return { ...common, duration: "5" };
}

/** fal.ai image-to-video adapter using its durable queue for crash-safe resumption. */
export class FalVideoProvider implements VideoProvider {
  private readonly client: FalVideoClient;
  private readonly fetch: Fetcher;
  private readonly pollMs: number;

  constructor(
    private readonly model: FalVideoModel,
    apiKey: string,
    options: { client?: FalVideoClient; fetch?: Fetcher; pollMs?: number } = {},
  ) {
    this.client = options.client ?? createClient(apiKey);
    this.fetch = options.fetch ?? globalThis.fetch;
    this.pollMs = options.pollMs ?? DEFAULT_POLL_MS;
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
    const config = FAL_VIDEO_MODELS[this.model];
    let requestId = existingJobId;
    let payload: Record<string, unknown> | undefined;

    if (!requestId) {
      const source = Bun.file(baseImagePath);
      if (!(await source.exists())) {
        throw new Error(`[fal video] base image does not exist: ${baseImagePath}`);
      }
      const contentType = MIME_BY_EXT[extname(baseImagePath).toLowerCase()] ?? source.type;
      const imageUrl = await this.client.upload(
        new File([source], basename(baseImagePath), { type: contentType || "image/png" }),
      );
      const input = modelInput(this.model, spec, imageUrl);
      payload = { model: config.endpoint, ...input };
      onPayload?.(payload);

      console.log(`[fal video] Animating run ${runId} with ${config.endpoint}...`);
      requestId = await this.client.submit(config.endpoint, input);
      if (!requestId) throw new Error("[fal video] no request id returned");
      await onJobId?.(requestId);
    } else {
      console.log(`[fal video] Resuming request ${requestId} for run ${runId}...`);
    }

    for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
      const status = await this.client.status(config.endpoint, requestId);
      if (status === "COMPLETED") {
        const parsed = videoResultSchema.safeParse(
          await this.client.result(config.endpoint, requestId),
        );
        if (!parsed.success) {
          throw new Error(`[fal video] invalid result: ${parsed.error.message}`);
        }
        const videoResponse = await this.fetch(parsed.data.video.url);
        if (!videoResponse.ok) {
          throw new Error(`[fal video] video download failed (${videoResponse.status})`);
        }
        const destPath = resolve(renderDir, `${runId}.mp4`);
        await Bun.write(destPath, new Uint8Array(await videoResponse.arrayBuffer()));
        console.log(`[fal video] Saved raw clip to ${destPath}`);
        return {
          path: destPath,
          provider: "fal",
          model: config.endpoint,
          costUsd: config.estimatedCostUsd,
          payload,
        };
      }
      console.log(`[fal video] ${status.toLowerCase()} for run ${runId} (poll ${attempt + 1})...`);
      await Bun.sleep(this.pollMs);
    }

    throw new Error(`[fal video] timed out waiting for request ${requestId}`);
  }
}
