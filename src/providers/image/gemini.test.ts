import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { MockLanguageModelV3 } from "ai/test";
import type { ShotSpec } from "@/core/run";
import { GeminiImageProvider } from "@/providers/image/gemini";

// PNG signature so the AI SDK detects image/png and the adapter picks `.png`.
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const SPEC: ShotSpec = {
  imagePrompt: "a lone vessel adrift past a luminous nebula",
  motionPrompt: "slow forward drift",
  captionDraft: "",
  style: "cosmic-scifi",
  orientation: "portrait",
};

// A recorded multimodal response: Gemini returns the image as a file content
// part, which generateText surfaces on `result.files`. No network, no spend.
function respondWithImage() {
  return async () => ({
    content: [{ type: "file" as const, mediaType: "image/png", data: PNG_BYTES }],
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    },
    warnings: [],
  });
}

describe("GeminiImageProvider", () => {
  test("reads the image file from the multimodal response and saves it", async () => {
    const model = new MockLanguageModelV3({ doGenerate: respondWithImage() });

    const runDir = await mkdtemp(resolve(tmpdir(), "gemini-image-"));
    try {
      const artifact = await new GeminiImageProvider(model).generate("test-run", runDir, SPEC);

      expect(artifact.provider).toBe("gemini");
      expect(artifact.costUsd).toBeGreaterThan(0);
      expect(artifact.path).toBe(resolve(runDir, "image.base.png"));

      const saved = await readFile(artifact.path);
      expect(saved.length).toBe(PNG_BYTES.length);
    } finally {
      await rm(runDir, { recursive: true, force: true });
    }
  });

  test("throws when the model returns no image", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: async () => ({
        content: [{ type: "text" as const, text: "no image here" }],
        finishReason: { unified: "stop" as const, raw: "stop" },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 1, text: 1, reasoning: 0 },
        },
        warnings: [],
      }),
    });

    const runDir = await mkdtemp(resolve(tmpdir(), "gemini-image-"));
    try {
      const provider = new GeminiImageProvider(model);
      expect(provider.generate("test-run", runDir, SPEC)).rejects.toThrow("no image");
    } finally {
      await rm(runDir, { recursive: true, force: true });
    }
  });
});
