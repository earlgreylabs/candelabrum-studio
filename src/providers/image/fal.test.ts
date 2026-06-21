import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { MockImageModelV3 } from "ai/test";
import type { ShotSpec } from "@/core/run";
import { FalImageProvider } from "@/providers/image/fal";

// PNG signature so the AI SDK detects image/png and the adapter picks `.png`.
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const SPEC: ShotSpec = {
  imagePrompt: "a lone vessel adrift past a luminous nebula",
  motionPrompt: "slow forward drift",
  captionDraft: "",
  style: "cosmic-scifi",
  orientation: "portrait",
};

describe("FalImageProvider", () => {
  test("generates a base image, saves it, and returns a fal artifact (no spend)", async () => {
    let receivedPrompt: string | undefined;
    let receivedAspect: string | undefined;
    const model = new MockImageModelV3({
      doGenerate: async (options) => {
        receivedPrompt = options.prompt;
        receivedAspect = options.aspectRatio;
        return {
          images: [PNG_BYTES],
          warnings: [],
          response: { timestamp: new Date(), modelId: "fal-ai/flux/dev", headers: {} },
        };
      },
    });

    const runDir = await mkdtemp(resolve(tmpdir(), "fal-image-"));
    try {
      const artifact = await new FalImageProvider(model).generate("test-run", runDir, SPEC);

      expect(artifact.provider).toBe("fal");
      expect(artifact.costUsd).toBeGreaterThan(0);
      expect(artifact.path).toBe(resolve(runDir, "image.base.png"));
      expect(receivedPrompt).toBe(SPEC.imagePrompt);
      expect(receivedAspect).toBe("9:16"); // portrait -> 9:16

      const saved = await readFile(artifact.path);
      expect(saved.length).toBe(PNG_BYTES.length);
    } finally {
      await rm(runDir, { recursive: true, force: true });
    }
  });
});
