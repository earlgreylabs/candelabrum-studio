import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { ShotSpec } from "@/core/run";
import {
  FAL_VIDEO_MODELS,
  type FalVideoClient,
  type FalVideoModel,
  FalVideoProvider,
} from "@/providers/video/fal";

const MP4_BYTES = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);

const SPEC: ShotSpec = {
  imagePrompt: "a colossal obsidian monolith",
  motionPrompt: "slow cinematic forward dolly toward the monolith",
  captionDraft: "",
  style: "cosmic-scifi",
  orientation: "portrait",
  seedHint: 42,
};

interface ClientState {
  uploads: number;
  submissions: Array<{ endpoint: string; input: Record<string, unknown> }>;
}

function fakeClient(state: ClientState): FalVideoClient {
  return {
    async upload(file) {
      state.uploads += 1;
      expect(file.name).toBe("image.base.jpg");
      return "https://assets.example/base.jpg";
    },
    async submit(endpoint, input) {
      state.submissions.push({ endpoint, input });
      return "request-123";
    },
    async status() {
      return "COMPLETED";
    },
    async result() {
      return { video: { url: "https://assets.example/video.mp4" } };
    },
  };
}

async function exercise(model: FalVideoModel, existingJobId?: string) {
  const state: ClientState = { uploads: 0, submissions: [] };
  const renderDir = await mkdtemp(resolve(tmpdir(), "fal-video-"));
  const baseImagePath = resolve(renderDir, "image.base.jpg");
  await writeFile(baseImagePath, new Uint8Array([0xff, 0xd8, 0xff]));
  const persisted: string[] = [];
  const download = async () => new Response(MP4_BYTES, { status: 200 });

  try {
    const provider = new FalVideoProvider(model, "fake-key", {
      client: fakeClient(state),
      fetch: download,
      pollMs: 0,
    });
    const artifact = await provider.animate(
      "test-run",
      renderDir,
      SPEC,
      baseImagePath,
      undefined,
      existingJobId,
      async (requestId) => {
        persisted.push(requestId);
      },
    );
    return { artifact, persisted, saved: await readFile(artifact.path), state };
  } finally {
    await rm(renderDir, { recursive: true, force: true });
  }
}

describe("FalVideoProvider", () => {
  test.each([
    ["cosmos", "portrait_16_9"],
    ["seedance", "9:16"],
    ["kling", undefined],
  ] as const)("submits %s with its model-specific image-to-video input", async (model, shape) => {
    const { artifact, persisted, saved, state } = await exercise(model);
    const submission = state.submissions[0];

    expect(state.uploads).toBe(1);
    expect(submission?.endpoint).toBe(FAL_VIDEO_MODELS[model].endpoint);
    expect(submission?.input.image_url).toBe("https://assets.example/base.jpg");
    expect(submission?.input.prompt).toBe(SPEC.motionPrompt);
    if (model === "cosmos") expect(submission?.input.image_size).toBe(shape);
    if (model === "seedance") expect(submission?.input.aspect_ratio).toBe(shape);
    if (model === "kling") expect(submission?.input.duration).toBe("5");
    expect(persisted).toEqual(["request-123"]);
    expect(artifact.provider).toBe("fal");
    expect(artifact.model).toBe(FAL_VIDEO_MODELS[model].endpoint);
    expect(saved).toEqual(Buffer.from(MP4_BYTES));
  });

  test("resumes a persisted request without uploading or submitting again", async () => {
    const { artifact, persisted, state } = await exercise("seedance", "request-existing");

    expect(state.uploads).toBe(0);
    expect(state.submissions).toHaveLength(0);
    expect(persisted).toHaveLength(0);
    expect(artifact.model).toBe(FAL_VIDEO_MODELS.seedance.endpoint);
  });
});
