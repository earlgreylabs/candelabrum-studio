import { copyFile, mkdir, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { ImageArtifact, ImageProvider } from "@/core/providers";
import type { ShotSpec } from "@/core/run";

export class ManualInboxImageProvider implements ImageProvider {
  async generate(runId: string, runDir: string, spec: ShotSpec): Promise<ImageArtifact> {
    const inboxDir = resolve(runDir, "inbox");
    await mkdir(inboxDir, { recursive: true });

    const instructionPath = resolve(inboxDir, "prompt.txt");
    const instruction = [
      `Run: ${runId}`,
      `Prompt: ${spec.imagePrompt}`,
      `Orientation: ${spec.orientation}`,
      spec.seedHint ? `Seed: ${spec.seedHint}` : "",
      "",
      `Drop the generated image (e.g. .png or .jpg) into this directory.`,
    ]
      .filter(Boolean)
      .join("\n");

    await Bun.write(instructionPath, instruction);

    console.log(`\n[ManualInbox] Awaiting image for run ${runId}`);
    console.log(`[ManualInbox] Prompt: ${spec.imagePrompt}`);
    console.log(`[ManualInbox] Drop your image into: ${inboxDir}\n`);

    while (true) {
      const files = await readdir(inboxDir);
      const images = files.filter(
        (f) => f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".jpeg"),
      );
      if (images.length > 0) {
        images.sort();
        const imageFile = images[0] as string;
        const sourcePath = resolve(inboxDir, imageFile);

        await Bun.sleep(100);

        const destPath = resolve(
          runDir,
          `image.base${imageFile.substring(imageFile.lastIndexOf("."))}`,
        );
        await copyFile(sourcePath, destPath);

        console.log(`[ManualInbox] Found ${imageFile}, ingested as base image.`);

        return {
          path: destPath,
          seed: spec.seedHint,
          provider: "manual",
          model: "manual",
          costUsd: 0,
        };
      }
      await Bun.sleep(500);
    }
  }
}
