import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSettings, type Settings } from "@/core/config";
import { RunExecutor } from "@/core/executor";
import { createRun, transition } from "@/core/run";
import { RunStore } from "@/core/store";
import type { ServerDependencies } from "@/server/contracts";
import { canAutoResume, resumeInterruptedRuns } from "@/server/runtime";

describe("server recovery", () => {
  let root: string;
  let settings: Settings;
  let store: RunStore;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "cs-runtime-"));
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

  test("does not automatically resubmit an interrupted paid stage", async () => {
    const run = createRun(settings, { orientation: "portrait" });
    await store.save(run);
    let contextBuilds = 0;
    const dependencies: ServerDependencies = {
      executor: new RunExecutor(),
      loadSettings: async () => settings,
      createStore: () => store,
      buildContext: async () => {
        contextBuilds += 1;
        throw new Error("unsafe context should not be built");
      },
      sleep: Bun.sleep,
      logError: () => {},
    };

    expect(await resumeInterruptedRuns(dependencies)).toBe(0);
    expect(contextBuilds).toBe(0);
    const persisted = await store.load(run.id);
    expect(persisted.status).toBe("directing");
    expect(persisted.lastError?.message).toContain("authorize a retry");
  });

  test("allows local stages and persisted remote jobs to resume", () => {
    const localRun = createRun(settings, { orientation: "portrait" });
    transition(localRun, "gate_a", "test");
    transition(localRun, "imaging", "test");
    transition(localRun, "gate_a5", "test");
    transition(localRun, "upscaling", "test");
    expect(canAutoResume(localRun, settings)).toBe(true);

    const videoRun = { ...localRun, status: "animating" as const };
    videoRun.artifacts = { providerJobId: "job-1" };
    expect(canAutoResume(videoRun, settings)).toBe(true);
  });
});
