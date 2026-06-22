import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { loadSettings, loadStyle, type Settings } from "@/core/config";
import { RunExecutor } from "@/core/executor";
import {
  passGate,
  prepRegenerate,
  recover as recoverRun,
  reject as rejectRun,
  revise as reviseRun,
} from "@/core/orchestrator";
import type { PipelineContext } from "@/core/pipeline";
import { createRun, isGate, isTerminal, type Run, recordRunFailure } from "@/core/run";
import { RunStore } from "@/core/store";
import { resolveDirector } from "@/providers/director";
import { resolveExporter } from "@/providers/export";
import { resolveImage } from "@/providers/image";
import { resolveVideo } from "@/providers/video";

const app = new Hono();
const configDir = resolve(process.cwd(), "config");
const executor = new RunExecutor();
const createRunRequestSchema = z.object({
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  style: z.string().min(1).optional().default("cosmic-scifi"),
  lore: z.string().min(1).optional(),
});

async function buildContext(
  settings: Settings,
  store: RunStore,
  run: Run,
): Promise<PipelineContext> {
  const director = resolveDirector(settings);
  const image = resolveImage(settings);
  const video = resolveVideo(settings);
  const exportProvider = resolveExporter();
  const style = run.style ? await loadStyle(configDir, run.style) : undefined;

  return {
    settings,
    store,
    director,
    image,
    video,
    export: exportProvider,
    style,
    log: (message) => console.log(`[Dashboard API] ${message}`),
    notify: (title, message) => {
      // Background spawn the notification so it doesn't block
      Bun.spawn(["osascript", "-e", `display notification "${message}" with title "${title}"`], {
        stdout: "ignore",
        stderr: "ignore",
      });
    },
  };
}

function startRun(run: Run, ctx: PipelineContext): boolean {
  return executor.start(run, ctx).started;
}

async function resumeInterruptedRuns(): Promise<void> {
  const settings = await loadSettings(configDir);
  const store = new RunStore(settings.paths.runs);
  const runs = await store.list();
  const interrupted = runs.filter((run) => !isGate(run.status) && !isTerminal(run.status));
  let resumed = 0;

  for (const run of interrupted) {
    try {
      const ctx = await buildContext(settings, store, run);
      if (startRun(run, ctx)) {
        resumed += 1;
      }
    } catch (error) {
      console.error(`[Server] could not resume run ${run.id}:`, error);
      recordRunFailure(run, error);
      await store.save(run);
    }
  }

  if (resumed > 0) {
    console.log(`[Server] resumed ${resumed} interrupted run(s)`);
  }
}

// Basic health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

// GET /api/runs
app.get("/api/runs", async (c) => {
  const settings = await loadSettings(configDir);
  const store = new RunStore(settings.paths.runs);
  const runs = await store.list();
  return c.json({ runs });
});

// POST /api/runs
app.post("/api/runs", async (c) => {
  const settings = await loadSettings(configDir);
  const store = new RunStore(settings.paths.runs);

  try {
    const body = c.req.header("content-type")?.includes("application/json")
      ? await c.req.json()
      : {};
    const input = createRunRequestSchema.parse(body);
    const run = createRun(settings, {
      orientation: input.orientation,
      style: input.style,
      lore: input.lore,
    });
    await store.save(run);
    const ctx = await buildContext(settings, store, run);
    startRun(run, ctx);
    return c.json({ run }, 201);
  } catch (err) {
    console.error("Failed to create run:", err);
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

// GET /api/runs/events - SSE endpoint. Must be registered before `/api/runs/:id`,
// otherwise Hono matches "events" as the :id param and 404s the stream.
app.get("/api/runs/events", (c) => {
  return streamSSE(c, async (stream) => {
    const settings = await loadSettings(configDir);
    const store = new RunStore(settings.paths.runs);

    let isClosed = false;
    c.req.raw.signal.addEventListener("abort", () => {
      isClosed = true;
    });

    while (!isClosed) {
      try {
        const runs = await store.list();
        await stream.writeSSE({
          data: JSON.stringify({ runs }),
          event: "runs-update",
        });
      } catch (err) {
        console.error("SSE stream error", err);
      }

      await Bun.sleep(2000);
    }
  });
});

// GET /api/runs/:id
app.get("/api/runs/:id", async (c) => {
  const settings = await loadSettings(configDir);
  const store = new RunStore(settings.paths.runs);
  try {
    const run = await store.load(c.req.param("id"));
    return c.json({ run });
  } catch {
    return c.json({ error: "Run not found" }, 404);
  }
});

// POST /api/runs/:id/advance
app.post("/api/runs/:id/advance", async (c) => {
  const settings = await loadSettings(configDir);
  const store = new RunStore(settings.paths.runs);
  const id = c.req.param("id");
  try {
    let note: string | undefined;
    let caption: string | undefined;
    if (c.req.header("content-type")?.includes("application/json")) {
      const body = await c.req.json();
      note = body.note;
      caption = body.caption;
    }

    const updated = await executor.mutate(id, async () => {
      const run = await store.load(id);
      const ctx = await buildContext(settings, store, run);
      const passed = await passGate(run, ctx, note, caption);
      startRun(passed, ctx);
      return passed;
    });
    return c.json({ run: updated }, 202);
  } catch (err) {
    console.error(`Failed to advance run ${id}:`, err);
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

// POST /api/runs/:id/reject
app.post("/api/runs/:id/reject", async (c) => {
  const settings = await loadSettings(configDir);
  const store = new RunStore(settings.paths.runs);
  const id = c.req.param("id");
  try {
    let note: string | undefined;
    if (c.req.header("content-type")?.includes("application/json")) {
      const body = await c.req.json();
      note = body.note;
    }

    const updated = await executor.mutate(id, async () => {
      const run = await store.load(id);
      const ctx = await buildContext(settings, store, run);
      return rejectRun(run, ctx, note);
    });
    return c.json({ run: updated });
  } catch (err) {
    console.error(`Failed to reject run ${id}:`, err);
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

// POST /api/runs/:id/revise
app.post("/api/runs/:id/revise", async (c) => {
  const settings = await loadSettings(configDir);
  const store = new RunStore(settings.paths.runs);
  const id = c.req.param("id");
  try {
    let instruction = "";
    if (c.req.header("content-type")?.includes("application/json")) {
      const body = await c.req.json();
      instruction = body.instruction;
    }
    if (!instruction) {
      return c.json({ error: "instruction is required for revise" }, 400);
    }

    const updated = await executor.mutate(id, async () => {
      const run = await store.load(id);
      const ctx = await buildContext(settings, store, run);
      return reviseRun(run, ctx, instruction);
    });
    return c.json({ run: updated });
  } catch (err) {
    console.error(`Failed to revise run ${id}:`, err);
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

// POST /api/runs/:id/regenerate
app.post("/api/runs/:id/regenerate", async (c) => {
  const settings = await loadSettings(configDir);
  const store = new RunStore(settings.paths.runs);
  const id = c.req.param("id");
  try {
    const updated = await executor.mutate(id, async () => {
      const run = await store.load(id);
      const ctx = await buildContext(settings, store, run);
      const prepared = await prepRegenerate(run, ctx);
      startRun(prepared, ctx);
      return prepared;
    });
    return c.json({ run: updated }, 202);
  } catch (err) {
    console.error(`Failed to regenerate run ${id}:`, err);
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

// POST /api/runs/:id/resume
app.post("/api/runs/:id/resume", async (c) => {
  const settings = await loadSettings(configDir);
  const store = new RunStore(settings.paths.runs);
  const id = c.req.param("id");
  try {
    const run = await store.load(id);
    const ctx = await buildContext(settings, store, run);

    // Advance the current state in the background. Useful if the node process
    // crashed or timed out while waiting for a long-running external job.
    const started = startRun(run, ctx);
    return c.json({ run, started }, 202);
  } catch (err) {
    console.error(`Failed to resume run ${id}:`, err);
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

// POST /api/runs/:id/recover
app.post("/api/runs/:id/recover", async (c) => {
  const settings = await loadSettings(configDir);
  const store = new RunStore(settings.paths.runs);
  const id = c.req.param("id");
  try {
    const recovered = await executor.mutate(id, async () => {
      const run = await store.load(id);
      const ctx = await buildContext(settings, store, run);
      const restored = await recoverRun(run, ctx);
      startRun(restored, ctx);
      return restored;
    });
    return c.json({ run: recovered }, 202);
  } catch (err) {
    console.error(`Failed to recover run ${id}:`, err);
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

// Serve a run's media artifact (base image / raw clip / master clip). The
// pipeline records absolute paths in different roots (runs/ for the base image,
// renders/ for video), so we resolve by kind from the run's own metadata rather
// than guessing a URL layout. `kind` is allowlisted; the path is pipeline-set,
// not client-supplied. Lives under /api/ so the Vite dev proxy forwards it (it
// only proxies /api, not /assets).
const SERVABLE_ARTIFACTS = [
  "image",
  "rawClip",
  "masterClip",
  "masterProxyClip",
  "exportVideo",
] as const;
type ServableArtifact = (typeof SERVABLE_ARTIFACTS)[number];

app.get("/api/runs/:id/asset/:kind", async (c) => {
  const kind = c.req.param("kind");
  if (!SERVABLE_ARTIFACTS.includes(kind as ServableArtifact)) {
    return c.text("Not Found", 404);
  }
  const settings = await loadSettings(configDir);
  const store = new RunStore(settings.paths.runs);
  try {
    const run = await store.load(c.req.param("id"));
    const path = run.artifacts[kind as ServableArtifact];
    if (path) {
      const file = Bun.file(path);
      if (await file.exists()) {
        return new Response(file);
      }
    }
  } catch {
    // fallthrough to 404
  }
  return c.text("Not Found", 404);
});

// In production, serve the Vite static assets
app.use("/*", serveStatic({ root: "./dist/public/" }));

// SPA Fallback for React Router
app.get("*", async (c) => {
  if (c.req.path.startsWith("/api/")) return c.text("Not Found", 404);
  try {
    const html = await readFile(resolve(process.cwd(), "dist/public/index.html"), "utf8");
    return c.html(html);
  } catch {
    return c.text("Not Found", 404);
  }
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
console.log(`[Server] Starting on http://127.0.0.1:${port}`);

if (import.meta.main) {
  void resumeInterruptedRuns().catch((error) => {
    console.error("[Server] failed to resume interrupted runs:", error);
  });
}

export default {
  port,
  hostname: "127.0.0.1",
  fetch: app.fetch,
};
