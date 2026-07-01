import { resolve } from "node:path";
import type { Hono } from "hono";
import type { Settings } from "@/core/config";
import type { ServerDependencies } from "@/server/contracts";

const SERVABLE_ARTIFACTS = [
  "image",
  "rawClip",
  "masterClip",
  "masterProxyClip",
  "exportVideo",
] as const;
type ServableArtifact = (typeof SERVABLE_ARTIFACTS)[number];

const ARTIFACT_ROOTS = [
  ["runs", (settings: Settings) => settings.paths.runs],
  ["renders", (settings: Settings) => settings.paths.renders],
  ["ready", (settings: Settings) => settings.paths.ready],
] as const;

async function existingArtifactPath(path: string, settings: Settings): Promise<string | undefined> {
  if (await Bun.file(path).exists()) {
    return path;
  }

  for (const [segment, root] of ARTIFACT_ROOTS) {
    const marker = `/${segment}/`;
    const index = path.indexOf(marker);
    if (index === -1) {
      continue;
    }

    const relativeArtifactPath = path.slice(index + marker.length);
    const candidate = resolve(root(settings), relativeArtifactPath);
    if (await Bun.file(candidate).exists()) {
      return candidate;
    }
  }

  return undefined;
}

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
        const resolvedPath = await existingArtifactPath(path, settings);
        if (!resolvedPath) {
          return c.text("Not Found", 404);
        }
        const file = Bun.file(resolvedPath);
        if (await file.exists()) return new Response(file);
      }
    } catch {
      // Missing runs and missing artifacts intentionally share a 404 response.
    }
    return c.text("Not Found", 404);
  });
}
