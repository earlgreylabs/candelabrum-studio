import { copyFile, mkdir, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { VideoArtifact, VideoProvider } from "@/core/providers";
import type { ShotSpec } from "@/core/run";

export class ManualInboxVideoProvider implements VideoProvider {
  async animate(
    runId: string,
    renderDir: string,
    spec: ShotSpec,
    baseImagePath: string,
  ): Promise<VideoArtifact> {
    const inboxDir = resolve(renderDir, `${runId}-inbox`);
    await mkdir(inboxDir, { recursive: true });

    const instructionPath = resolve(inboxDir, "prompt.txt");
    const instruction = [
      `Run: ${runId}`,
      `Base Image: ${baseImagePath}`,
      `Motion Prompt: ${spec.motionPrompt}`,
      `Orientation: ${spec.orientation}`,
      "",
      `Drop the generated video (e.g. .mp4) into this directory.`,
    ].join("\n");

    await Bun.write(instructionPath, instruction);

    console.log(`\n[ManualInbox] Awaiting video for run ${runId}`);
    console.log(`[ManualInbox] Motion Prompt: ${spec.motionPrompt}`);
    console.log(`[ManualInbox] Drop your video into: ${inboxDir}\n`);

    while (true) {
      const files = await readdir(inboxDir);
      const videos = files.filter((f) => f.endsWith(".mp4") || f.endsWith(".mov"));
      if (videos.length > 0) {
        videos.sort();
        const videoFile = videos[0] as string;
        const sourcePath = resolve(inboxDir, videoFile);

        await Bun.sleep(100);

        const destPath = resolve(
          renderDir,
          `${runId}${videoFile.substring(videoFile.lastIndexOf("."))}`,
        );
        await copyFile(sourcePath, destPath);

        console.log(`[ManualInbox] Found ${videoFile}, ingested as raw clip.`);

        return {
          path: destPath,
          provider: "manual",
          costUsd: 0,
        };
      }
      await Bun.sleep(500);
    }
  }
}
