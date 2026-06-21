import { Hono } from "hono";
import { serveStatic } from "hono/bun";

const app = new Hono();

// Basic health check
app.get("/api/health", (c) => c.json({ status: "ok" }));

// Dummy runs endpoint to prove the API is wired up
app.get("/api/runs", (c) => c.json({ runs: [] }));

// In production, serve the Vite static assets
app.use("/*", serveStatic({ root: "./dist/public/" }));

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
console.log(`[Server] Starting on http://127.0.0.1:${port}`);

export default {
  port,
  hostname: "127.0.0.1",
  fetch: app.fetch,
};
