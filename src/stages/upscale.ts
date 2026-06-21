import { copyFile, mkdir } from "node:fs/promises";
import { extname, resolve, dirname } from "node:path";
import type { Stage } from "@/core/pipeline";
import type { Run } from "@/core/run";

const TPAI_BIN = "/Applications/Topaz Photo AI.app/Contents/MacOS/Topaz Photo AI";

/** Degrade gracefully: just pass through the base image if Topaz is not installed. */
async function passThrough(run: Run, imagePath: string, upscaledPath: string): Promise<void> {
  await copyFile(imagePath, upscaledPath);
  run.artifacts.upscaledImage = upscaledPath;
  run.cost.push({
    stage: "upscale",
    provider: "pass-through",
    model: "pass-through",
    amountUsd: 0,
  });
}

/**
 * Uses Topaz Photo AI CLI to upscale and sharpen the base image before animation.
 * This ensures the video generator receives a high-res, highly detailed input,
 * resulting in the extreme crispness seen in professional AI videos.
 */
export const upscale: Stage = async (run, ctx) => {
  if (!run.artifacts.image) {
    throw new Error(`run ${run.id} has no base image to upscale`);
  }
  const imagePath = run.artifacts.image;
  const ext = extname(imagePath);

  // We'll store the upscaled image in the run's directory
  const runDir = dirname(imagePath);
  const upscaledPath = resolve(runDir, `image.upscaled${ext}`);

  const fileExists = await Bun.file(TPAI_BIN).exists();

  if (fileExists) {
    ctx.log(`[Upscale] Topaz Photo AI found, upscaling base image...`);
    try {
      // Topaz CLI typically works by specifying an output directory or file prefix.
      const proc = Bun.spawn([TPAI_BIN, "--cli", imagePath, "--output", runDir], {
        stdout: "pipe",
        stderr: "pipe",
      });

      await proc.exited;
      if (proc.exitCode !== 0) {
        const stderr = (await new Response(proc.stderr).text()).trim();
        throw new Error(`Topaz Photo AI exited ${proc.exitCode}: ${stderr.slice(-400)}`);
      }

      // Topaz creates an `-edit` or `-autopilot` suffix by default when outputting to the same dir.
      const baseName = imagePath.replace(ext, "");
      const possibleOutputs = [
        `${baseName}-edit${ext}`,
        `${baseName}-autopilot${ext}`,
        `${baseName}-upscale${ext}`,
      ];

      let foundOutput = false;
      for (const p of possibleOutputs) {
        if (await Bun.file(p).exists()) {
          await copyFile(p, upscaledPath);
          foundOutput = true;
          break;
        }
      }

      if (!foundOutput) {
        ctx.log(`[Upscale] Could not find Topaz output, falling back to pass-through.`);
        await passThrough(run, imagePath, upscaledPath);
        return;
      }

      run.artifacts.upscaledImage = upscaledPath;
      run.cost.push({
        stage: "upscale",
        provider: "topaz",
        model: "photo-ai",
        amountUsd: 0,
      });
      ctx.log(`[Upscale] Image upscaled successfully.`);
      return;
    } catch (err) {
      ctx.log(
        `[Upscale] failed (${err instanceof Error ? err.message : err}); passing image through.`,
      );
    }
  } else {
    ctx.log(`[Upscale] Topaz Photo AI not found at ${TPAI_BIN}; passing image through.`);
  }

  await passThrough(run, imagePath, upscaledPath);
};
