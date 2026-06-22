import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSettings, type Settings } from "@/core/config";
import { RunExecutor } from "@/core/executor";
import type { PipelineContext } from "@/core/pipeline";
import type { DirectorCapability } from "@/core/provider-selection";
import type { DirectorLLM, Exporter, ImageProvider, VideoProvider } from "@/core/providers";
import { createRun, type Run, transition } from "@/core/run";
import { RunStore } from "@/core/store";
import { createApp } from "@/server/app";
import type { ServerDependencies } from "@/server/contracts";

const director: DirectorLLM = {
  modelId: "test-director",
  async proposeConcepts() {
    return [{ title: "Test", summary: "Test concept", subject: "test subject" }];
  },
  async revise(concept) {
    return concept;
  },
  async finalise(_concept, orientation) {
    return {
      imagePrompt: "test image",
      motionPrompt: "test motion",
      captionDraft: "test caption",
      style: "none",
      orientation,
    };
  },
  async caption() {
    return "test caption";
  },
};

const unusedImage: ImageProvider = {
  async generate() {
    throw new Error("image provider should not run in server route tests");
  },
};
const unusedVideo: VideoProvider = {
  async animate() {
    throw new Error("video provider should not run in server route tests");
  },
};
const unusedExport: Exporter = {
  async package() {
    throw new Error("export provider should not run in server route tests");
  },
  async finalize() {
    throw new Error("export provider should not run in server route tests");
  },
};

describe("HTTP app", () => {
  let root: string;
  let settings: Settings;
  let store: RunStore;
  let dependencies: ServerDependencies;
  let app: ReturnType<typeof createApp>;
  let buildDirectorCapabilities: Array<DirectorCapability | undefined>;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "cs-server-"));
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
    buildDirectorCapabilities = [];
    dependencies = {
      executor: new RunExecutor(),
      loadSettings: async () => settings,
      createStore: () => store,
      buildContext: async (
        _settings,
        _store,
        _run,
        directorCapability,
      ): Promise<PipelineContext> => {
        buildDirectorCapabilities.push(directorCapability);
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
      },
      sleep: Bun.sleep,
      logError: () => {},
    };
    app = createApp(dependencies);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("health and run listing use injected storage", async () => {
    const health = await app.request("/api/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: "ok" });

    const list = await app.request("/api/runs");
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual({ runs: [] });
  });

  test("lists capability-aware provider options", async () => {
    const response = await app.request("/api/providers");
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      options: Array<{ id: string; capability: string }>;
    };
    expect(
      body.options.some((option) => option.id === "wavespeed" && option.capability === "image"),
    ).toBe(true);
    expect(
      body.options.some((option) => option.id === "wavespeed" && option.capability === "video"),
    ).toBe(true);
  });

  test("gets a run and returns 404 for an unknown run", async () => {
    const run = createRun(settings, { orientation: "portrait" });
    await store.save(run);

    const found = await app.request(`/api/runs/${run.id}`);
    expect(found.status).toBe(200);
    expect(((await found.json()) as { run: Run }).run.id).toBe(run.id);

    const missing = await app.request("/api/runs/missing");
    expect(missing.status).toBe(404);
  });

  test("validates create and revise request bodies", async () => {
    const invalidCreate = await app.request("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orientation: "square" }),
    });
    expect(invalidCreate.status).toBe(400);

    const run = createRun(settings, { orientation: "portrait" });
    transition(run, "gate_a", "test");
    await store.save(run);
    const invalidRevise = await app.request(`/api/runs/${run.id}/revise`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction: "  " }),
    });
    expect(invalidRevise.status).toBe(400);
  });

  test("persists concept authorization before starting a new run", async () => {
    const previousKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-key";
    try {
      const response = await app.request("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptProvider: "claude" }),
      });
      expect(response.status).toBe(201);
      const run = ((await response.json()) as { run: Run }).run;
      await Bun.sleep(10);
      const persisted = await store.load(run.id);
      expect(persisted.providerSelections.concept).toBe("claude");
      expect(persisted.events.some((event) => event.note === "concept:claude")).toBe(true);
    } finally {
      if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = previousKey;
    }
  });

  test("does not create a run when the provider lacks the requested capability", async () => {
    const response = await app.request("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conceptProvider: "manual" }),
    });
    expect(response.status).toBe(400);
    expect(await store.list()).toEqual([]);
  });

  test("rejects a run through the injected executor and store", async () => {
    const run = createRun(settings, { orientation: "portrait" });
    transition(run, "gate_a", "test");
    await store.save(run);

    const response = await app.request(`/api/runs/${run.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "rejected concept via API" }),
    });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { run: Run }).run.status).toBe("rejected");
    expect((await store.load(run.id)).status).toBe("rejected");
  });

  test("rejects a provider that does not support the requested operation", async () => {
    const run = createRun(settings, { orientation: "portrait" });
    transition(run, "gate_a", "test");
    transition(run, "imaging", "test");
    transition(run, "gate_a5", "test");
    await store.save(run);

    const response = await app.request(`/api/runs/${run.id}/regenerate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "claude" }),
    });
    expect(response.status).toBe(400);
    expect(
      (await store.load(run.id)).events.some((event) => event.type === "provider_authorized"),
    ).toBe(false);
  });

  test("resumes animation with fal-kling without routing it through the director", async () => {
    const previousKey = process.env.FAL_KEY;
    process.env.FAL_KEY = "test-key";
    try {
      const run = createRun(settings, { orientation: "portrait" });
      run.status = "animating";
      run.shotSpec = {
        imagePrompt: "image",
        motionPrompt: "motion",
        captionDraft: "caption",
        style: "none",
        orientation: "portrait",
      };
      run.artifacts.image = join(root, "image.png");
      run.lastError = {
        at: new Date().toISOString(),
        status: "animating",
        message: "Veo failed",
        attempt: 1,
        retryable: true,
      };
      await store.save(run);

      const response = await app.request(`/api/runs/${run.id}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "fal-kling" }),
      });

      expect(response.status).toBe(202);
      expect(buildDirectorCapabilities).toEqual([undefined]);
      expect((await store.load(run.id)).providerSelections.video).toBe("fal-kling");
    } finally {
      if (previousKey === undefined) delete process.env.FAL_KEY;
      else process.env.FAL_KEY = previousKey;
    }
  });

  test("authorizes caption passthrough atomically at Gate B", async () => {
    const run = createRun(settings, { orientation: "portrait" });
    run.status = "gate_b";
    run.shotSpec = {
      imagePrompt: "image",
      motionPrompt: "motion",
      captionDraft: "draft",
      style: "none",
      orientation: "portrait",
    };
    await store.save(run);

    const response = await app.request(`/api/runs/${run.id}/advance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: "edited", captionProvider: "draft" }),
    });
    expect(response.status).toBe(202);
    await Bun.sleep(10);
    const persisted = await store.load(run.id);
    expect(persisted.providerSelections.caption).toBe("draft");
    expect(
      persisted.cost.some((entry) => entry.stage === "caption" && entry.provider === "draft"),
    ).toBe(true);
  });

  test("serves allowlisted assets and rejects unknown artifact kinds", async () => {
    const path = join(root, "image.png");
    await Bun.write(path, "image fixture");
    const run = createRun(settings, { orientation: "portrait" });
    run.artifacts.image = path;
    await store.save(run);

    const asset = await app.request(`/api/runs/${run.id}/asset/image`);
    expect(asset.status).toBe(200);
    expect(await asset.text()).toBe("image fixture");

    const blocked = await app.request(`/api/runs/${run.id}/asset/metadata`);
    expect(blocked.status).toBe(404);
  });

  test("events resolves to SSE before the dynamic run route", async () => {
    const controller = new AbortController();
    const response = await app.fetch(
      new Request("http://localhost/api/runs/events", { signal: controller.signal }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    if (!response.body) throw new Error("events response had no body");
    const reader = response.body.getReader();
    const { value } = await reader.read();
    expect(new TextDecoder().decode(value)).toContain("runs-update");
    await reader.cancel();
    controller.abort();
  });
});
