import type { Hono } from "hono";
import type { ServerDependencies } from "@/server/contracts";

const SERVABLE_ARTIFACTS = [
  "image",
  "rawClip",
  "masterClip",
  "masterProxyClip",
  "exportVideo",
] as const;
type ServableArtifact = (typeof SERVABLE_ARTIFACTS)[number];

export function registerAssetRoutes(app: Hono, dependencies: ServerDependencies): void {
  app.get("/api/runs/:id/asset/:kind", async (c) => {
    const kind = c.req.param("kind");
    if (!SERVABLE_ARTIFACTS.includes(kind as ServableArtifact)) {
      return c.text("Not Found", 404);
    }

    const settings = await dependencies.loadSettings();
    const store = dependencies.createStore(settings);
    try {
      const run = await store.load(c.req.param("id"));
      const path = run.artifacts[kind as ServableArtifact];
      if (path) {
        const file = Bun.file(path);
        if (await file.exists()) return new Response(file);
      }
    } catch {
      // Missing runs and missing artifacts intentionally share a 404 response.
    }
    return c.text("Not Found", 404);
  });
}
