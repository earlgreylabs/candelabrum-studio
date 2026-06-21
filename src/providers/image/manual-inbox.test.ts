import { describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { ManualInboxImageProvider } from "./manual-inbox";

describe("ManualInboxImageProvider", () => {
  test("watches inbox and ingests a dropped image", async () => {
    const runId = "test-run";
    const runDir = join(import.meta.dir, "temp-run-dir");
    await mkdir(runDir, { recursive: true });

    try {
      const provider = new ManualInboxImageProvider();
      const spec = {
        imagePrompt: "test prompt",
        motionPrompt: "test motion",
        captionDraft: "test",
        style: "test",
        orientation: "portrait" as const,
        seedHint: 123,
      };

      const generatePromise = provider.generate(runId, runDir, spec);

      await Bun.sleep(100);
      const inboxDir = join(runDir, "inbox");
      const dropFile = join(inboxDir, "dropped.png");
      await Bun.write(dropFile, "fake image content");

      const artifact = await generatePromise;

      expect(artifact.provider).toBe("manual");
      expect(artifact.seed).toBe(123);
      expect(artifact.path).toBe(join(runDir, "image.base.png"));

      const ingested = await Bun.file(artifact.path).text();
      expect(ingested).toBe("fake image content");
    } finally {
      await rm(runDir, { recursive: true, force: true });
    }
  });
});
