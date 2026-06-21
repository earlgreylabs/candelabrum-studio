import { describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { ManualInboxVideoProvider } from "./manual-inbox";

describe("ManualInboxVideoProvider", () => {
  test("watches inbox and ingests a dropped video", async () => {
    const runId = "test-run";
    const renderDir = join(import.meta.dir, "temp-render-dir");
    await mkdir(renderDir, { recursive: true });

    try {
      const provider = new ManualInboxVideoProvider();
      const spec = {
        imagePrompt: "test",
        motionPrompt: "test motion",
        captionDraft: "test",
        style: "test",
        orientation: "portrait" as const,
      };

      const baseImage = join(renderDir, "base.png");

      const animatePromise = provider.animate(runId, renderDir, spec, baseImage);

      await Bun.sleep(100);
      const inboxDir = join(renderDir, `${runId}-inbox`);
      const dropFile = join(inboxDir, "dropped.mp4");
      await Bun.write(dropFile, "fake video content");

      const artifact = await animatePromise;

      expect(artifact.provider).toBe("manual");
      expect(artifact.path).toBe(join(renderDir, "test-run.mp4"));

      const ingested = await Bun.file(artifact.path).text();
      expect(ingested).toBe("fake video content");
    } finally {
      await rm(renderDir, { recursive: true, force: true });
    }
  });
});
