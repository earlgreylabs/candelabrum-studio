import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSettings, type Settings } from "@/core/config";
import type { PipelineContext } from "@/core/pipeline";
import type { Exporter, ImageProvider, VideoProvider } from "@/core/providers";
import { createRun } from "@/core/run";
import { RunStore } from "@/core/store";
import { createInterpolate } from "@/stages/interpolate";

describe("interpolate stage", () => {
  let root: string;
  let settings: Settings;
  let ctx: PipelineContext;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "cs-interpolate-"));
    const base = await loadSettings("./config");
    settings = {
      ...base,
      paths: {
        runs: join(root, "runs"),
        renders: join(root, "renders"),
        ready: join(root, "ready"),
      },
    };
    const unused = async () => {
      throw new Error("unused provider");
    };
    ctx = {
      settings,
      store: new RunStore(settings.paths.runs),
      director: {
        modelId: "unused",
        proposeConcepts: unused,
        revise: unused,
        finalise: unused,
        caption: unused,
      },
      image: { generate: unused } as ImageProvider,
      video: { animate: unused } as VideoProvider,
      export: { package: unused, finalize: unused } as Exporter,
      log: () => {},
      notify: () => {},
    };
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("records an explicit pass-through when local tools are missing", async () => {
    const rawClip = join(root, "raw.mp4");
    await Bun.write(rawClip, "raw clip");
    const run = createRun(settings, { orientation: "portrait" });
    run.artifacts.rawClip = rawClip;
    const stage = createInterpolate({
      which: () => null,
      run: async () => {},
      probeFps: async () => 30,
    });

    await stage(run, ctx);

    expect(run.artifacts.masterMode).toBe("pass-through");
    expect(run.artifacts.masterNote).toContain("missing local tools");
    expect(await Bun.file(run.artifacts.masterClip as string).text()).toBe("raw clip");
  });

  test("surfaces an installed-tool failure instead of silently passing through", async () => {
    const rawClip = join(root, "raw.mp4");
    await Bun.write(rawClip, "raw clip");
    const run = createRun(settings, { orientation: "portrait" });
    run.artifacts.rawClip = rawClip;
    const stage = createInterpolate({
      which: (binary) => `/fake/${binary}`,
      run: async () => {
        throw new Error("ffmpeg extraction failed");
      },
      probeFps: async () => 30,
    });

    expect(stage(run, ctx)).rejects.toThrow("ffmpeg extraction failed");
    expect(run.artifacts.masterClip).toBeUndefined();
    expect(run.artifacts.masterMode).toBeUndefined();
  });
});
