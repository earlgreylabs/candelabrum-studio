import type { Hono } from "hono";
import { listProviderOptions, providerDefaults } from "@/providers/catalog";
import type { ServerDependencies } from "@/server/contracts";

export function registerProviderRoutes(app: Hono, dependencies: ServerDependencies): void {
  app.get("/api/providers", async (c) => {
    const settings = await dependencies.loadSettings();
    return c.json({ options: listProviderOptions(), defaults: providerDefaults(settings) });
  });
}
