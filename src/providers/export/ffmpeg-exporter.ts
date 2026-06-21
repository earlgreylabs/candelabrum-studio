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

    const finalMp4 = resolve(outDir, `${run.id}.mp4`);

    const ffmpegPath = Bun.which("ffmpeg");
    if (!ffmpegPath) {
      console.log(`[FfmpegExporter] ffmpeg not found, passing through master clip.`);
      await copyFile(masterClipPath, finalMp4);
      return { dir: outDir, video: finalMp4 };
    }

    const lutPath = resolve(process.cwd(), "assets/luts/cinematic.cube");
    
    console.log(`[FfmpegExporter] Burning LUT and encoding H.264...`);
    const proc = Bun.spawn(
      [
        ffmpegPath,
        "-y",
        "-i",
        masterClipPath,
        "-vf",
        `lut3d=${lutPath}`,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-profile:v",
        "high",
        "-b:v",
        "15M",
        "-pix_fmt",
        "yuv420p",
        finalMp4,
      ],
      { stdout: "ignore", stderr: "pipe" },
    );
    await proc.exited;

    if (proc.exitCode !== 0) {
      const stderr = (await new Response(proc.stderr).text()).trim();
      throw new Error(`ffmpeg exited ${proc.exitCode}: ${stderr.slice(-400)}`);
    }

    return { dir: outDir, video: finalMp4 };
  }
}
