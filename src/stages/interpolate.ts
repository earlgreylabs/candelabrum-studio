import { copyFile, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, resolve } from "node:path";
import type { Stage } from "@/core/pipeline";
import type { Run } from "@/core/run";

// ffmpeg `prores_ks -profile:v 3` = ProRes 422 HQ (the flat archival master).
const PRORES_422_HQ = "3";

interface InterpolationRuntime {
  which(binary: string): string | null;
  run(cmd: string[]): Promise<void>;
  probeFps(ffprobe: string, clip: string): Promise<number>;
}

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

const defaultRuntime: InterpolationRuntime = {
  which: (binary) => Bun.which(binary),
  run: runCmd,
  probeFps,
};

/** Degrade gracefully: the source clip becomes the master, ungraded. */
async function passThrough(
  run: Run,
  rawClip: string,
  masterDir: string,
  runtime: InterpolationRuntime,
  note: string,
): Promise<void> {
  const masterClipPath = resolve(masterDir, `${run.id}${extname(rawClip)}`);
  await copyFile(rawClip, masterClipPath);
  run.artifacts.masterClip = masterClipPath;

  // Create an MP4 proxy for the UI if it's a MOV file to prevent MIME errors
  const ffmpeg = runtime.which("ffmpeg");
  if (ffmpeg && extname(masterClipPath).toLowerCase() === ".mov") {
    const masterProxyClipPath = resolve(masterDir, `${run.id}-proxy.mp4`);
    await runtime.run([
      ffmpeg,
      "-y",
      "-i",
      masterClipPath,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-profile:v",
      "high",
      "-pix_fmt",
      "yuv420p",
      masterProxyClipPath,
    ]);
    run.artifacts.masterProxyClip = masterProxyClipPath;
  } else if (extname(masterClipPath).toLowerCase() === ".mp4") {
    run.artifacts.masterProxyClip = masterClipPath; // mp4 is already playable
  }

  run.artifacts.masterMode = "pass-through";
  run.artifacts.masterNote = note;

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
 * ffmpeg extracts frames -> rife inserts in-between frames -> ffmpeg encodes.
 * Missing tools degrade explicitly to pass-through. Installed tools that fail are
 * actionable failures and leave the run resumable at `interpolating`.
 */
export function createInterpolate(runtime: InterpolationRuntime = defaultRuntime): Stage {
  return async (run, ctx) => {
    if (!run.artifacts.rawClip) {
      throw new Error(`run ${run.id} has no raw clip`);
    }
    if (run.artifacts.masterClip && (await Bun.file(run.artifacts.masterClip).exists())) {
      ctx.log(`[Interpolate] Reusing persisted master for run ${run.id}.`);
      return;
    }

    const rawClip = run.artifacts.rawClip;
    const masterDir = resolve(ctx.settings.paths.renders, "master");
    await mkdir(masterDir, { recursive: true });

    const rife = runtime.which("rife-ncnn-vulkan");
    const ffmpeg = runtime.which("ffmpeg");
    const ffprobe = runtime.which("ffprobe");
    const missing = [
      !rife && "rife-ncnn-vulkan",
      !ffmpeg && "ffmpeg",
      !ffprobe && "ffprobe",
    ].filter((binary): binary is string => Boolean(binary));

    if (missing.length > 0 || !rife || !ffmpeg || !ffprobe) {
      const note = `missing local tools: ${missing.join(", ")}`;
      ctx.log(`[Interpolate] ${note}; passing raw clip through.`);
      await passThrough(run, rawClip, masterDir, runtime, note);
      return;
    }

    const work = await mkdtemp(resolve(tmpdir(), `interp-${run.id}-`));
    const srcFrames = resolve(work, "src");
    const outFrames = resolve(work, "out");

    try {
      await mkdir(srcFrames, { recursive: true });
      await mkdir(outFrames, { recursive: true });

      const sourceFps = await runtime.probeFps(ffprobe, rawClip);
      const masterFps = ctx.settings.targets.masterFps;
      ctx.log(`[Interpolate] ${sourceFps}fps -> ${masterFps}fps via rife-ncnn-vulkan...`);

      await runtime.run([ffmpeg, "-y", "-i", rawClip, resolve(srcFrames, "%08d.png")]);
      const srcCount = (await readdir(srcFrames)).length;
      if (srcCount === 0) {
        throw new Error("no frames extracted from raw clip");
      }

      const targetCount = Math.max(srcCount, Math.round((srcCount * masterFps) / sourceFps));
      const rifeArgs = [rife, "-i", srcFrames, "-o", outFrames, "-n", String(targetCount)];
      if (process.env.RIFE_MODEL) {
        rifeArgs.push("-m", process.env.RIFE_MODEL);
      }
      await runtime.run(rifeArgs);

      const outputCount = (await readdir(outFrames)).length;
      if (outputCount < targetCount) {
        throw new Error(`rife produced ${outputCount} frames; expected at least ${targetCount}`);
      }

      const masterClipPath = resolve(masterDir, `${run.id}.mov`);
      const masterProxyClipPath = resolve(masterDir, `${run.id}-proxy.mp4`);
      await runtime.run([
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
      await runtime.run([
        ffmpeg,
        "-y",
        "-framerate",
        String(masterFps),
        "-i",
        resolve(outFrames, "%08d.png"),
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-profile:v",
        "high",
        "-pix_fmt",
        "yuv420p",
        masterProxyClipPath,
      ]);

      run.artifacts.masterClip = masterClipPath;
      run.artifacts.masterProxyClip = masterProxyClipPath;
      run.artifacts.masterMode = "interpolated";
      run.artifacts.masterNote = undefined;
      run.cost.push({
        stage: "interpolate",
        provider: "rife-ncnn-vulkan",
        model: "rife-ncnn-vulkan",
        amountUsd: 0,
      });
      ctx.log(
        `[Interpolate] master written (${srcCount} -> ${outputCount} frames): ${masterClipPath}`,
      );
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  };
}

export const interpolate = createInterpolate();
