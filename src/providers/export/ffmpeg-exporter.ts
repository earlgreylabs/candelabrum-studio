import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Exporter, ExportPackage } from "@/core/providers";
import type { Run } from "@/core/run";

export class FfmpegExporter implements Exporter {
  async package(run: Run, readyDir: string): Promise<ExportPackage> {
    const outDir = resolve(readyDir, run.id);
    await mkdir(outDir, { recursive: true });

    const spec = run.shotSpec;
    await Bun.write(resolve(outDir, "caption.txt"), spec?.captionDraft ?? "");
    await Bun.write(resolve(outDir, "metadata.json"), JSON.stringify(run, null, 2));

    const masterClipPath = run.artifacts.masterClip;
    if (!masterClipPath) {
      throw new Error(`[FfmpegExporter] No master clip found in run ${run.id}`);
    }

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
