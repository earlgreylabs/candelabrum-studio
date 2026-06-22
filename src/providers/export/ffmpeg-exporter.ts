import { copyFile, mkdir } from "node:fs/promises";
import { extname, resolve } from "node:path";
import type { Exporter, ExportPackage } from "@/core/providers";
import type { Run } from "@/core/run";

interface ExportRuntime {
  which(binary: string): string | null;
  run(command: string[]): Promise<void>;
}

async function runCommand(command: string[]): Promise<void> {
  const proc = Bun.spawn(command, { stdout: "ignore", stderr: "pipe" });
  await proc.exited;

  if (proc.exitCode !== 0) {
    const stderr = (await new Response(proc.stderr).text()).trim();
    throw new Error(`${command[0]} exited ${proc.exitCode}: ${stderr.slice(-400)}`);
  }
}

const defaultRuntime: ExportRuntime = {
  which: (binary) => Bun.which(binary),
  run: runCommand,
};

export class FfmpegExporter implements Exporter {
  constructor(private readonly runtime: ExportRuntime = defaultRuntime) {}

  async package(run: Run, readyDir: string): Promise<ExportPackage> {
    const outDir = resolve(readyDir, run.id);
    await mkdir(outDir, { recursive: true });

    const masterClipPath = run.artifacts.masterClip;
    if (!masterClipPath) {
      throw new Error(`[FfmpegExporter] No master clip found in run ${run.id}`);
    }

    await Bun.write(resolve(outDir, "caption.txt"), run.shotSpec?.captionDraft ?? "");

    const packagedMaster = resolve(outDir, `master${extname(masterClipPath)}`);
    await copyFile(masterClipPath, packagedMaster);

    const finalMp4 = resolve(outDir, `${run.id}.mp4`);
    const ffmpegPath = this.runtime.which("ffmpeg");
    if (!ffmpegPath) {
      console.log(`[FfmpegExporter] ffmpeg not found; package contains the master only.`);
      return { dir: outDir, video: packagedMaster };
    }

    const lutPath = resolve(process.cwd(), "assets/luts/cinematic.cube");

    console.log(`[FfmpegExporter] Burning LUT and encoding H.264...`);
    await this.runtime.run([
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
    ]);

    return { dir: outDir, video: finalMp4 };
  }

  async finalize(run: Run, packageDir: string): Promise<void> {
    await Bun.write(resolve(packageDir, "metadata.json"), JSON.stringify(run, null, 2));
  }
}
