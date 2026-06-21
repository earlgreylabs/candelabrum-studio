import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSettings, loadStyle, type Settings, type Style } from "@/core/config";
import { advance, approve, reject } from "@/core/orchestrator";
import type { PipelineContext } from "@/core/pipeline";
import type { DirectorLLM, ImageProvider } from "@/core/providers";
import { createRun, type Run, transition } from "@/core/run";
import { RunStore } from "@/core/store";

// A deterministic director, so the pipeline is exercised without an API call.
const fakeDirector: DirectorLLM = {
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
    return { path, seed: 42, provider: "fake-image", costUsd: 0 };
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
    ctx = { settings, store, style, director: fakeDirector, image: fakeImage, log: () => {} };
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
    expect(run.shotSpec?.imagePrompt).toContain("nebula");
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
      log: () => {},
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
});
