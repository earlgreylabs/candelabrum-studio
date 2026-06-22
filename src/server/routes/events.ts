import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { ServerDependencies } from "@/server/contracts";

export function registerEventRoutes(app: Hono, dependencies: ServerDependencies): void {
  // Register before `/api/runs/:id` so "events" is not interpreted as a run id.
  app.get("/api/runs/events", (c) =>
    streamSSE(c, async (stream) => {
      const settings = await dependencies.loadSettings();
      const store = dependencies.createStore(settings);
      let closed = false;
      c.req.raw.signal.addEventListener("abort", () => {
        closed = true;
      });

      while (!closed) {
        try {
          await stream.writeSSE({
            data: JSON.stringify({ runs: await store.list() }),
            event: "runs-update",
          });
        } catch (error) {
          dependencies.logError("SSE stream error", error);
        }
        await dependencies.sleep(2000);
      }
    }),
  );
}
