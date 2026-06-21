import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { streamSSE } from "hono/streaming";
import { loadSettings, loadStyle, type Settings } from "@/core/config";
import {
  advance,
  passGate,
  prepRegenerate,
  reject as rejectRun,
  revise as reviseRun,
} from "@/core/orchestrator";
import type { PipelineContext } from "@/core/pipeline";
import { type Run, transition, createRun } from "@/core/run";
import { RunStore } from "@/core/store";
import { resolveDirector } from "@/providers/director";
import { resolveExporter } from "@/providers/export";
import { resolveImage } from "@/providers/image";
import { resolveVideo } from "@/providers/video";

const app = new Hono();
const configDir = resolve(process.cwd(), "config");

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

/**
 * Drive `advance` outside the request/response cycle. A stage may block
 * indefinitely (a `ManualInbox` awaiting a file drop), so the endpoint returns
 * as soon as the gate transition is persisted and progress is observed over the
 * SSE stream. On failure the run is marked `failed` and persisted, since nothing
 * awaits this promise.
 */
function advanceInBackground(run: Run, ctx: PipelineContext): void {
  void advance(run, ctx).catch(async (err) => {
    console.error(`Background advance failed for run ${run.id}:`, err);
    try {
      transition(run, "failed", "stage", err instanceof Error ? err.message : String(err));
      await ctx.store.save(run);
    } catch (saveErr) {
      console.error(`Failed to persist failed state for run ${run.id}:`, saveErr);
    }
  });
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
  
  let orientation: any = "portrait";
  let styleId: string | undefined = "cosmic-scifi";
  let lore: string | undefined;

  if (c.req.header("content-type")?.includes("application/json")) {
    const body = await c.req.json();
    if (body.orientation) orientation = body.orientation;
    if (body.style) styleId = body.style;
    if (body.lore) lore = body.lore;
  }

  try {
    const run = createRun(settings, { orientation, style: styleId, lore });
    await store.save(run);
    const ctx = await buildContext(settings, store, run);
    advanceInBackground(run, ctx);
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
    const run = await store.load(id);
    const ctx = await buildContext(settings, store, run);
    // Parse optional note from body if any
    let note: string | undefined;
    let caption: string | undefined;
    if (c.req.header("content-type")?.includes("application/json")) {
      const body = await c.req.json();
      note = body.note;
      caption = body.caption;
    }

    // Pass the gate synchronously, then advance through the (possibly blocking)
    // next stage in the background; the dashboard tracks progress over SSE.
    const updated = await passGate(run, ctx, note, caption);
    advanceInBackground(updated, ctx);
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
    const run = await store.load(id);
    const ctx = await buildContext(settings, store, run);
    let note: string | undefined;
    if (c.req.header("content-type")?.includes("application/json")) {
      const body = await c.req.json();
      note = body.note;
    }

    const updated = await rejectRun(run, ctx, note);
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
    const run = await store.load(id);
    const ctx = await buildContext(settings, store, run);

    let instruction = "";
    if (c.req.header("content-type")?.includes("application/json")) {
      const body = await c.req.json();
      instruction = body.instruction;
    }
    if (!instruction) {
      return c.json({ error: "instruction is required for revise" }, 400);
    }

    const updated = await reviseRun(run, ctx, instruction);
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
    const run = await store.load(id);
    const ctx = await buildContext(settings, store, run);

    // Step back synchronously, then re-run the (possibly blocking) stage in the
    // background; the dashboard tracks progress over SSE.
    const updated = await prepRegenerate(run, ctx);
    advanceInBackground(updated, ctx);
    return c.json({ run: updated }, 202);
  } catch (err) {
    console.error(`Failed to regenerate run ${id}:`, err);
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
  }
});

// Serve a run's media artifact (base image / raw clip / master clip). The
// pipeline records absolute paths in different roots (runs/ for the base image,
// renders/ for video), so we resolve by kind from the run's own metadata rather
// than guessing a URL layout. `kind` is allowlisted; the path is pipeline-set,
// not client-supplied. Lives under /api/ so the Vite dev proxy forwards it (it
// only proxies /api, not /assets).
const SERVABLE_ARTIFACTS = ["image", "rawClip", "masterClip", "masterProxyClip", "exportVideo"] as const;
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

export default {
  port,
  hostname: "127.0.0.1",
  fetch: app.fetch,
};
