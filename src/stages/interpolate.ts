import { copyFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, resolve } from "node:path";
import type { Stage } from "@/core/pipeline";
import type { Run } from "@/core/run";

// ffmpeg `prores_ks -profile:v 3` = ProRes 422 HQ (the flat archival master).
const PRORES_422_HQ = "3";

async function runCmd(cmd: string[]): Promise<void> {
  const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "pipe" });
  await proc.exited;
  if (proc.exitCode !== 0) {
    const stderr = (await new Response(proc.stderr).text()).trim();
    throw new Error(`${cmd[0]} exited ${proc.exitCode}: ${stderr.slice(-400)}`);
  }
}

/** Source frame rate, parsed from ffprobe's `r_frame_rate` (e.g. "24/1"). */
async function probeFps(ffprobe: string, clip: string): Promise<number> {
  const proc = Bun.spawn(
    [
      ffprobe,
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=r_frame_rate",
      "-of",
      "csv=p=0",
      clip,
    ],
    { stdout: "pipe", stderr: "ignore" },
  );
  await proc.exited;
  const raw = (await new Response(proc.stdout).text()).trim();
  const parts = raw.split("/");
  const num = Number(parts[0]);
  const den = parts[1] ? Number(parts[1]) : 1;
  const fps = den ? num / den : num;
  if (!fps || !Number.isFinite(fps)) {
    throw new Error(`could not parse source fps from "${raw}"`);
  }
  return fps;
}

/** Degrade gracefully: the source clip becomes the master, ungraded. */
async function passThrough(run: Run, rawClip: string, masterDir: string): Promise<void> {
  const masterClipPath = resolve(masterDir, `${run.id}${extname(rawClip)}`);
  await copyFile(rawClip, masterClipPath);
  run.artifacts.masterClip = masterClipPath;
  run.cost.push({
    stage: "interpolate",
    provider: "pass-through",
    model: "pass-through",
    amountUsd: 0,
  });
}

/**
 * Frame-interpolate the raw clip up to `masterFps` with rife-ncnn-vulkan (local,
 * Apple GPU via MoltenVK), wrapping the result into a flat ProRes 422 HQ master:
 * ffmpeg extracts frames -> rife inserts in-between frames -> ffmpeg encodes. If
 * the local tools are missing or the run fails, the raw clip passes through as the
 * master (the documented "no GPU -> no interpolation" degrade), so the pipeline
 * never stalls here.
 */
export const interpolate: Stage = async (run, ctx) => {
  if (!run.artifacts.rawClip) {
    throw new Error(`run ${run.id} has no raw clip`);
  }
  const rawClip = run.artifacts.rawClip;
  const masterDir = resolve(ctx.settings.paths.renders, "master");
  await mkdir(masterDir, { recursive: true });

  const rife = Bun.which("rife-ncnn-vulkan");
  const ffmpeg = Bun.which("ffmpeg");
  const ffprobe = Bun.which("ffprobe");

  if (rife && ffmpeg && ffprobe) {
    const work = await mkdtemp(resolve(tmpdir(), `interp-${run.id}-`));
    const srcFrames = resolve(work, "src");
    const outFrames = resolve(work, "out");
    try {
      await mkdir(srcFrames, { recursive: true });
      await mkdir(outFrames, { recursive: true });

      const sourceFps = await probeFps(ffprobe, rawClip);
      const masterFps = ctx.settings.targets.masterFps;
      ctx.log(`[Interpolate] ${sourceFps}fps -> ${masterFps}fps via rife-ncnn-vulkan...`);

      await runCmd([ffmpeg, "-y", "-i", rawClip, resolve(srcFrames, "%08d.png")]);
      const srcCount = (await readdir(srcFrames)).length;
      if (srcCount === 0) {
        throw new Error("no frames extracted from raw clip");
      }
      const targetCount = Math.max(srcCount, Math.round((srcCount * masterFps) / sourceFps));

      // Some rife installs resolve models relative to the binary; others need the
      // model dir passed explicitly. RIFE_MODEL (optional) covers the latter.
      const rifeArgs = [rife, "-i", srcFrames, "-o", outFrames, "-n", String(targetCount)];
      if (process.env.RIFE_MODEL) {
        rifeArgs.push("-m", process.env.RIFE_MODEL);
      }
      await runCmd(rifeArgs);
      const masterClipPath = resolve(masterDir, `${run.id}.mov`);
      await runCmd([
        ffmpeg,
        "-y",
        "-framerate",
        String(masterFps),
        "-i",
        resolve(outFrames, "%08d.png"),
        "-c:v",
        "prores_ks",
        "-profile:v",
        PRORES_422_HQ,
        "-pix_fmt",
        "yuv422p10le",
        masterClipPath,
      ]);

      run.artifacts.masterClip = masterClipPath;
      run.cost.push({
        stage: "interpolate",
        provider: "rife-ncnn-vulkan",
        model: "rife-ncnn-vulkan",
        amountUsd: 0,
      });
      ctx.log(
        `[Interpolate] master written (${srcCount} -> ${targetCount} frames): ${masterClipPath}`,
      );
      return;
    } catch (err) {
      ctx.log(
        `[Interpolate] failed (${err instanceof Error ? err.message : err}); passing raw clip through.`,
      );
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  } else {
    ctx.log(`[Interpolate] rife/ffmpeg not found; passing raw clip through.`);
  }

  await passThrough(run, rawClip, masterDir);
};
