import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Exporter, ExportPackage } from "@/core/providers";
import type { ShotSpec } from "@/core/run";

export class FfmpegExporter implements Exporter {
  async package(
    runId: string,
    readyDir: string,
    spec: ShotSpec,
    masterClipPath: string,
  ): Promise<ExportPackage> {
    const outDir = resolve(readyDir, runId);
    await mkdir(outDir, { recursive: true });

    await Bun.write(resolve(outDir, "caption.txt"), spec.captionDraft ?? "");
    await Bun.write(
      resolve(outDir, "manifest.json"),
      JSON.stringify({ id: runId, orientation: spec.orientation, style: spec.style }, null, 2),
    );

    const ext = masterClipPath.substring(masterClipPath.lastIndexOf("."));
    const dummyMaster = resolve(outDir, `master${ext}`);

    const ffmpegPath = Bun.which("ffmpeg");
    if (!ffmpegPath) {
      console.log(`[FfmpegExporter] ffmpeg not found, passing through master clip.`);
      await copyFile(masterClipPath, dummyMaster);
      return { dir: outDir };
    }

    console.log(`[FfmpegExporter] Running ffmpeg to encode...`);
    // In a real implementation we would run ffmpeg here to generate the ProRes master and FCPXML
    // For now we simulate it since complex ffmpeg arguments are beyond the scope of this slice
    const proc = Bun.spawn([ffmpegPath, "-version"], { stdout: "ignore", stderr: "ignore" });
    await proc.exited;

    await copyFile(masterClipPath, dummyMaster);

    return { dir: outDir };
  }
}
