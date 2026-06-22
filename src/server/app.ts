import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import type { ServerDependencies } from "@/server/contracts";
import { registerAssetRoutes } from "@/server/routes/assets";
import { registerEventRoutes } from "@/server/routes/events";
import { registerHealthRoutes } from "@/server/routes/health";
import { registerProviderRoutes } from "@/server/routes/providers";
import { registerRunRoutes } from "@/server/routes/runs";

export function createApp(dependencies: ServerDependencies): Hono {
  const app = new Hono();
  registerHealthRoutes(app);
  registerProviderRoutes(app, dependencies);
  registerEventRoutes(app, dependencies);
  registerRunRoutes(app, dependencies);
  registerAssetRoutes(app, dependencies);

  app.use("/*", serveStatic({ root: "./dist/public/" }));
  app.get("*", async (c) => {
    if (c.req.path.startsWith("/api/")) return c.text("Not Found", 404);
    try {
      return c.html(await readFile(resolve(process.cwd(), "dist/public/index.html"), "utf8"));
    } catch {
      return c.text("Not Found", 404);
    }
  });
  return app;
}
