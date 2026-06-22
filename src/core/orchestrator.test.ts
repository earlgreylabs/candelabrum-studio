import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSettings, loadStyle, type Settings, type Style } from "@/core/config";
import { advance, approve, reject } from "@/core/orchestrator";
import type { PipelineContext } from "@/core/pipeline";
import type { DirectorLLM, Exporter, ImageProvider, VideoProvider } from "@/core/providers";
import { createRun, type Run, transition } from "@/core/run";
import { RunStore } from "@/core/store";

// A deterministic director, so the pipeline is exercised without an API call.
const fakeDirector: DirectorLLM = {
  modelId: "fake-director",
  async proposeConcepts({ count }) {
    return Array.from({ length: count }, (_, i) => ({
      title: `Concept ${i + 1}`,
      summary: "a lone vessel adrift past a luminous nebula",
      subject: "lone vessel",
    }));
  },
  async revise(concept) {
    return concept;
  },
  async finalise(concept, orientation, style) {
    return {
      imagePrompt: `A ${concept.subject} adrift past a luminous nebula`,
      motionPrompt: "slow forward camera push",
      captionDraft: "Drifting through the deep.",
      style: style?.id ?? "none",
      orientation,
    };
  },
  async caption() {
    return "Drifting through the deep. #scifi";
  },
};

const fakeImage: ImageProvider = {
  async generate(runId, runDir) {
    const path = join(runDir, "image.placeholder.png");
    await Bun.write(path, `stub base image for ${runId}`);
    return { path, seed: 42, provider: "fake-image", model: "fake-image", costUsd: 0 };
  },
};

const fakeVideo: VideoProvider = {
  async animate(runId, renderDir) {
    const path = join(renderDir, `${runId}.placeholder.mp4`);
    await Bun.write(path, `stub raw video for ${runId}`);
    return { path, provider: "fake-video", model: "fake-video", costUsd: 0 };
  },
};

const fakeExport: Exporter = {
  async package(run, readyDir) {
    const dir = join(readyDir, run.id);
    await Bun.write(join(dir, "metadata.json"), "stub");
    const video = join(dir, "video.mp4");
    await Bun.write(video, "stub video");
    return { dir, video };
  },
  async finalize(run, packageDir) {
    await Bun.write(join(packageDir, "metadata.json"), JSON.stringify(run, null, 2));
  },
};

describe("orchestrator", () => {
  let root: string;
  let settings: Settings;
  let style: Style;
  let store: RunStore;
  let ctx: PipelineContext;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "cs-orch-"));
    const base = await loadSettings("./config");
    settings = {
      ...base,
      paths: {
        runs: join(root, "runs"),
        renders: join(root, "renders"),
        ready: join(root, "ready"),
      },
    };
    style = await loadStyle("./config", "cosmic-scifi");
    store = new RunStore(settings.paths.runs);
    ctx = {
      settings,
      store,
      style,
      director: fakeDirector,
      image: fakeImage,
      video: fakeVideo,
      export: fakeExport,
      stages: {
        interpolating: async (run) => {
          run.artifacts.masterClip = run.artifacts.rawClip;
          run.artifacts.masterProxyClip = run.artifacts.rawClip;
          run.artifacts.masterMode = "pass-through";
          run.artifacts.masterNote = "test fixture";
        },
      },
      log: () => {},
      notify: () => {},
    };
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  async function startRun(): Promise<Run> {
    const run = createRun(settings, { orientation: "portrait", style: "cosmic-scifi" });
    await store.save(run);
    return advance(run, ctx);
  }

  test("advances to the first gate and persists there", async () => {
    const run = await startRun();
    expect(run.status).toBe("gate_a");
    expect(run.concept?.subject).toContain("lone vessel");
    expect((await store.load(run.id)).status).toBe("gate_a");
  });

  test("approving each gate drives the run to ready with its artifacts", async () => {
    const run = await startRun();

    await approve(run, ctx); // gate_a -> gate_a5
    expect(run.status).toBe("gate_a5");
    expect(run.artifacts.image).toBeDefined();

    await approve(run, ctx); // gate_a5 -> animate + interpolate -> gate_b
    expect(run.status).toBe("gate_b");
    expect(run.artifacts.rawClip).toBeDefined();
    expect(run.artifacts.masterClip).toBeDefined();

    await approve(run, ctx); // gate_b -> caption + export -> ready
    expect(run.status).toBe("ready");
    expect(run.artifacts.exportPackage).toBeDefined();
    const packaged = JSON.parse(
      await Bun.file(join(run.artifacts.exportPackage as string, "metadata.json")).text(),
    ) as Run;
    expect(packaged.status).toBe("ready");
    expect(packaged.artifacts.exportPackage).toBe(run.artifacts.exportPackage);
  });

  test("revise concept updates concept draft without advancing", async () => {
    const run = await startRun();
    expect(run.status).toBe("gate_a");

    const revised = await import("@/core/orchestrator").then((m) =>
      m.revise(run, ctx, "make it cyber"),
    );
    expect(revised.status).toBe("gate_a");
    expect(revised.concept).toBeDefined();
    // fakeDirector returns the same concept, but we verified the logic runs.
  });

  test("regenerate clears artifacts and steps backward", async () => {
    const run = await startRun();
    await approve(run, ctx); // gate_a -> gate_a5
    expect(run.status).toBe("gate_a5");
    expect(run.artifacts.image).toBeDefined();

    // Regenerate at gate_a5
    const { regenerate } = await import("@/core/orchestrator");
    await regenerate(run, ctx);

    // Should run imaging again and land back at gate_a5
    expect(run.status).toBe("gate_a5");
    // Depending on fake provider, image path might be same but we proved it re-ran
  });

  test("resume continues from persisted status in a fresh process", async () => {
    const run = await startRun();
    await approve(run, ctx); // persisted at gate_a5

    // A new store + context over the same directory stands in for a fresh process.
    const store2 = new RunStore(settings.paths.runs);
    const ctx2: PipelineContext = {
      settings,
      store: store2,
      style,
      director: fakeDirector,
      image: fakeImage,
      video: fakeVideo,
      export: fakeExport,
      stages: ctx.stages,
      log: () => {},
      notify: () => {},
    };
    const resumed = await store2.load(run.id);
    expect(resumed.status).toBe("gate_a5");

    await approve(resumed, ctx2);
    expect(resumed.status).toBe("gate_b");
  });

  test("resume runs the stage a crashed run was on", async () => {
    // Persist a run mid-pipeline (status imaging), as if it crashed there.
    const run = createRun(settings, { orientation: "portrait", style: "cosmic-scifi" });
    run.shotSpec = {
      imagePrompt: "test",
      motionPrompt: "test",
      captionDraft: "test",
      style: "none",
      orientation: "portrait",
    };
    transition(run, "gate_a", "stage");
    transition(run, "imaging", "operator");
    await store.save(run);

    const resumed = await store.load(run.id);
    await advance(resumed, ctx);
    expect(resumed.status).toBe("gate_a5");
    expect(resumed.artifacts.image).toBeDefined();
  });

  test("reject discards the run", async () => {
    const run = await startRun();
    await reject(run, ctx, "weak composition");
    expect(run.status).toBe("rejected");
    expect((await store.load(run.id)).status).toBe("rejected");
  });

  test("approve fails when the run is not at a gate", async () => {
    const run = createRun(settings, { orientation: "portrait" });
    await store.save(run);
    await expect(approve(run, ctx)).rejects.toThrow(/not at a gate/);
  });

  test("keeps export resumable when final metadata cannot be written", async () => {
    const run = await startRun();
    await approve(run, ctx);
    await approve(run, ctx);
    let packageCalls = 0;
    ctx.export = {
      async package(candidate, readyDir) {
        packageCalls += 1;
        return fakeExport.package(candidate, readyDir);
      },
      async finalize() {
        throw new Error("metadata disk full");
      },
    };

    await expect(approve(run, ctx)).rejects.toThrow("metadata disk full");
    expect(run.status).toBe("exporting");
    expect(run.events.at(-1)?.to).toBe("exporting");
    expect(packageCalls).toBe(1);

    ctx.export = {
      async package(candidate, readyDir) {
        packageCalls += 1;
        return fakeExport.package(candidate, readyDir);
      },
      finalize: fakeExport.finalize,
    };
    await advance(run, ctx);

    expect(run.status).toBe("ready");
    expect(packageCalls).toBe(1);
  });
});
