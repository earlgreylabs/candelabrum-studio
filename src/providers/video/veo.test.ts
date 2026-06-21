import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { ShotSpec } from "@/core/run";
import { VeoVideoProvider } from "@/providers/video/veo";

const MP4_BYTES = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]);

const SPEC: ShotSpec = {
  imagePrompt: "a colossal obsidian monolith",
  motionPrompt: "slow cinematic forward dolly toward the monolith",
  captionDraft: "",
  style: "cosmic-scifi",
  orientation: "portrait",
};

interface PredictBody {
  instances: Array<{ prompt: string; image: { bytesBase64Encoded: string; mimeType: string } }>;
  parameters: { aspectRatio: string; sampleCount: number };
}

describe("VeoVideoProvider", () => {
  test("submits image-to-video, polls, and saves the returned clip (no spend)", async () => {
    let predictBody: PredictBody | undefined;
    let polls = 0;

    // Fake the predictLongRunning -> poll -> done flow.
    const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      if (url.endsWith(":predictLongRunning")) {
        predictBody = JSON.parse(String(init?.body)) as PredictBody;
        return new Response(JSON.stringify({ name: "operations/test-op" }), { status: 200 });
      }
      if (url.includes("operations/test-op")) {
        polls += 1;
        if (polls < 2) {
          return new Response(JSON.stringify({ done: false }), { status: 200 });
        }
        return new Response(
          JSON.stringify({
            done: true,
            response: {
              generateVideoResponse: {
                generatedSamples: [
                  { video: { bytesBase64Encoded: Buffer.from(MP4_BYTES).toString("base64") } },
                ],
              },
            },
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch to ${url}`);
    }) as typeof fetch;

    const renderDir = await mkdtemp(resolve(tmpdir(), "veo-"));
    const baseImagePath = resolve(renderDir, "image.base.jpg");
    await writeFile(baseImagePath, new Uint8Array([0xff, 0xd8, 0xff]));

    try {
      const provider = new VeoVideoProvider("veo-test", "fake-key", {
        fetch: fakeFetch,
        pollMs: 0,
      });
      const artifact = await provider.animate("test-run", renderDir, SPEC, baseImagePath);

      expect(artifact.provider).toBe("veo");
      expect(artifact.model).toBe("veo-test");
      expect(artifact.costUsd).toBeGreaterThan(0);
      expect(artifact.path).toBe(resolve(renderDir, "test-run.mp4"));

      // image-to-video: the base image is sent as bytesBase64Encoded, not inlineData.
      expect(predictBody?.instances[0]?.image.bytesBase64Encoded).toBeTruthy();
      expect(predictBody?.instances[0]?.image.mimeType).toBe("image/jpeg");
      expect(predictBody?.parameters.aspectRatio).toBe("9:16");
      expect(polls).toBe(2); // polled until done

      const saved = await readFile(artifact.path);
      expect(saved.length).toBe(MP4_BYTES.length);
    } finally {
      await rm(renderDir, { recursive: true, force: true });
    }
  });

  test("resumes existing job id without submitting again", async () => {
    let predictCalls = 0;

    const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = input.toString();
      if (url.endsWith(":predictLongRunning")) {
        predictCalls += 1;
        return new Response(JSON.stringify({ name: "operations/new-op" }), { status: 200 });
      }
      if (url.includes("operations/existing-op")) {
        return new Response(
          JSON.stringify({
            done: true,
            response: {
              generateVideoResponse: {
                generatedSamples: [
                  { video: { bytesBase64Encoded: Buffer.from(MP4_BYTES).toString("base64") } },
                ],
              },
            },
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch to ${url}`);
    }) as typeof fetch;

    const renderDir = await mkdtemp(resolve(tmpdir(), "veo-"));
    const baseImagePath = resolve(renderDir, "image.base.jpg");
    await writeFile(baseImagePath, new Uint8Array([0xff, 0xd8, 0xff]));

    try {
      const provider = new VeoVideoProvider("veo-test", "fake-key", {
        fetch: fakeFetch,
        pollMs: 0,
      });
      const artifact = await provider.animate(
        "test-run",
        renderDir,
        SPEC,
        baseImagePath,
        undefined,
        "operations/existing-op",
      );

      expect(predictCalls).toBe(0); // Should skip submission
      expect(artifact.path).toBe(resolve(renderDir, "test-run.mp4"));
    } finally {
      await rm(renderDir, { recursive: true, force: true });
    }
  });
});
