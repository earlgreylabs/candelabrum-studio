import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { streamSSE } from "hono/streaming";
import { loadSettings, loadStyle, type Settings, type Style } from "@/core/config";
import { RunStore } from "@/core/store";
import { approve, reject as rejectRun } from "@/core/orchestrator";
import type { PipelineContext } from "@/core/pipeline";
import type { Run } from "@/core/run";
import { resolveDirector } from "@/providers/director";
import { resolveExporter } from "@/providers/export";
import { resolveImage } from "@/providers/image";
import { resolveVideo } from "@/providers/video";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";

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
  };
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

// GET /api/runs/:id
app.get("/api/runs/:id", async (c) => {
  const settings = await loadSettings(configDir);
  const store = new RunStore(settings.paths.runs);
  try {
    const run = await store.load(c.req.param("id"));
    return c.json({ run });
  } catch (err) {
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
    if (c.req.header("content-type")?.includes("application/json")) {
      const body = await c.req.json();
      note = body.note;
    }

    const updated = await approve(run, ctx, note);
    return c.json({ run: updated });
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

// GET /api/runs/events - SSE endpoint
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

// Asset proxy: allow frontend to load artifacts (images/videos)
app.get("/assets/renders/*", async (c) => {
  const path = c.req.path.replace("/assets/renders/", "");
  const settings = await loadSettings(configDir);
  const fullPath = resolve(settings.paths.renders, path);
  try {
    const file = Bun.file(fullPath);
    if (await file.exists()) {
      return new Response(file);
    }
  } catch (e) {
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
  } catch (e) {
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
