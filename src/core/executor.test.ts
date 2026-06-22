import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSettings, type Settings } from "@/core/config";
import { RunExecutor } from "@/core/executor";
import type { PipelineContext } from "@/core/pipeline";
import type { DirectorLLM, Exporter, ImageProvider, VideoProvider } from "@/core/providers";
import { createRun } from "@/core/run";
import { RunStore } from "@/core/store";

const unusedImage: ImageProvider = {
  async generate() {
    throw new Error("image provider should not run");
  },
};

const unusedVideo: VideoProvider = {
  async animate() {
    throw new Error("video provider should not run");
  },
};

const unusedExport: Exporter = {
  async package() {
    throw new Error("export provider should not run");
  },
  async finalize() {
    throw new Error("export provider should not run");
  },
};

describe("RunExecutor", () => {
  let root: string;
  let settings: Settings;
  let store: RunStore;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "cs-executor-"));
    const base = await loadSettings("./config");
    settings = {
      ...base,
      paths: {
        runs: join(root, "runs"),
        renders: join(root, "renders"),
        ready: join(root, "ready"),
      },
    };
    store = new RunStore(settings.paths.runs);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  function context(director: DirectorLLM): PipelineContext {
    return {
      settings,
      store,
      director,
      image: unusedImage,
      video: unusedVideo,
      export: unusedExport,
      log: () => {},
      notify: () => {},
    };
  }

  test("deduplicates concurrent execution for the same run", async () => {
    let calls = 0;
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const director: DirectorLLM = {
      modelId: "test",
      async proposeConcepts() {
        calls += 1;
        await blocked;
        return [{ title: "One", summary: "One", subject: "One" }];
      },
      async revise(concept) {
        return concept;
      },
      async finalise() {
        throw new Error("not used");
      },
      async caption() {
        throw new Error("not used");
      },
    };
    const run = createRun(settings, { orientation: "portrait" });
    await store.save(run);

    const executor = new RunExecutor();
    const first = executor.start(run, context(director));
    const duplicate = executor.start(run, context(director));

    expect(first.started).toBe(true);
    expect(duplicate.started).toBe(false);
    expect(duplicate.task).toBe(first.task);

    release?.();
    await first.task;

    expect(calls).toBe(1);
    expect(run.status).toBe("gate_a");
    expect(executor.isActive(run.id)).toBe(false);
  });

  test("persists a retryable error without losing the resume status", async () => {
    const director: DirectorLLM = {
      modelId: "test",
      async proposeConcepts() {
        throw new Error("temporary provider outage");
      },
      async revise(concept) {
        return concept;
      },
      async finalise() {
        throw new Error("not used");
      },
      async caption() {
        throw new Error("not used");
      },
    };
    const run = createRun(settings, { orientation: "portrait" });
    await store.save(run);

    const result = new RunExecutor().start(run, context(director));
    await result.task;

    const persisted = await store.load(run.id);
    expect(persisted.status).toBe("directing");
    expect(persisted.lastError?.message).toContain("temporary provider outage");
    expect(persisted.lastError?.retryable).toBe(true);
    expect(persisted.events.at(-1)?.type).toBe("stage_error");
  });

  test("serializes mutations for the same run", async () => {
    const executor = new RunExecutor();
    const order: string[] = [];
    let release: (() => void) | undefined;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = executor.mutate("run-1", async () => {
      order.push("first:start");
      await blocked;
      order.push("first:end");
    });
    const second = executor.mutate("run-1", async () => {
      order.push("second");
    });

    await Bun.sleep(0);
    expect(order).toEqual(["first:start"]);
    release?.();
    await Promise.all([first, second]);
    expect(order).toEqual(["first:start", "first:end", "second"]);
  });
});
