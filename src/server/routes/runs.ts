import type { Hono } from "hono";
import { z } from "zod";
import {
  passGate,
  prepRegenerate,
  recover as recoverRun,
  reject as rejectRun,
  revise as reviseRun,
} from "@/core/orchestrator";
import type { DirectorCapability, ProviderCapability } from "@/core/provider-selection";
import { authorizeProvider, createRun } from "@/core/run";
import { providerOption } from "@/providers/catalog";
import type { ServerDependencies } from "@/server/contracts";
import { badRequest, errorMessage, optionalJson } from "@/server/http";

const createRunRequestSchema = z.object({
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  style: z.string().min(1).optional().default("cosmic-scifi"),
  lore: z.string().min(1).optional(),
  conceptProvider: z.string().min(1).optional(),
});
const advanceRequestSchema = z.object({
  note: z.string().optional(),
  caption: z.string().optional(),
  finaliseProvider: z.string().min(1).optional(),
  imageProvider: z.string().min(1).optional(),
  videoProvider: z.string().min(1).optional(),
  captionProvider: z.string().min(1).optional(),
});
const noteRequestSchema = z.object({ note: z.string().optional() });
const providerRequestSchema = z.object({ provider: z.string().min(1).optional() });
const reviseRequestSchema = z.object({
  instruction: z.string().trim().min(1),
  provider: z.string().min(1).optional(),
});

interface AuthorizationRequest {
  capability: ProviderCapability;
  provider?: string;
}

async function authorize(
  run: ReturnType<typeof createRun>,
  store: ReturnType<ServerDependencies["createStore"]>,
  requests: AuthorizationRequest[],
): Promise<void> {
  const validated = requests.map(({ capability, provider: requested }) => {
    const provider = requested ?? run.providerSelections[capability];
    if (!provider) throw new Error(`A ${capability} provider is required`);
    const option = providerOption(capability, provider);
    if (!option.available) {
      throw new Error(option.unavailableReason ?? `${provider} is unavailable`);
    }
    return { capability, provider };
  });
  for (const { capability, provider } of validated) {
    authorizeProvider(run, capability, provider);
  }
  await store.save(run);
}

export function registerRunRoutes(app: Hono, dependencies: ServerDependencies): void {
  app.get("/api/runs", async (c) => {
    const settings = await dependencies.loadSettings();
    return c.json({ runs: await dependencies.createStore(settings).list() });
  });

  app.post("/api/runs", async (c) => {
    try {
      const settings = await dependencies.loadSettings();
      const store = dependencies.createStore(settings);
      const input = createRunRequestSchema.parse(await optionalJson(c));
      const run = createRun(settings, input);
      await authorize(run, store, [{ capability: "concept", provider: input.conceptProvider }]);
      const context = await dependencies.buildContext(settings, store, run, "concept");
      dependencies.executor.start(run, context);
      return c.json({ run }, 201);
    } catch (error) {
      dependencies.logError("Failed to create run", error);
      return badRequest(c, errorMessage(error));
    }
  });

  app.get("/api/runs/:id", async (c) => {
    const settings = await dependencies.loadSettings();
    try {
      return c.json({ run: await dependencies.createStore(settings).load(c.req.param("id")) });
    } catch {
      return c.json({ error: "Run not found" }, 404);
    }
  });

  app.post("/api/runs/:id/advance", async (c) => {
    const id = c.req.param("id");
    try {
      const input = advanceRequestSchema.parse(await optionalJson(c));
      const settings = await dependencies.loadSettings();
      const store = dependencies.createStore(settings);
      const updated = await dependencies.executor.mutate(id, async () => {
        const run = await store.load(id);
        let directorCapability: DirectorCapability | undefined;
        if (run.status === "gate_a") {
          await authorize(run, store, [
            { capability: "finalise", provider: input.finaliseProvider },
            { capability: "image", provider: input.imageProvider },
          ]);
          directorCapability = "finalise";
        } else if (run.status === "gate_a5") {
          await authorize(run, store, [{ capability: "video", provider: input.videoProvider }]);
        } else if (run.status === "gate_b") {
          await authorize(run, store, [{ capability: "caption", provider: input.captionProvider }]);
          directorCapability = "caption";
        }
        const context = await dependencies.buildContext(settings, store, run, directorCapability);
        const passed = await passGate(run, context, input.note, input.caption);
        dependencies.executor.start(passed, context);
        return passed;
      });
      return c.json({ run: updated }, 202);
    } catch (error) {
      dependencies.logError(`Failed to advance run ${id}`, error);
      return badRequest(c, errorMessage(error));
    }
  });

  app.post("/api/runs/:id/reject", async (c) => {
    const id = c.req.param("id");
    try {
      const input = noteRequestSchema.parse(await optionalJson(c));
      const settings = await dependencies.loadSettings();
      const store = dependencies.createStore(settings);
      const updated = await dependencies.executor.mutate(id, async () => {
        const run = await store.load(id);
        const context = await dependencies.buildContext(settings, store, run);
        return rejectRun(run, context, input.note);
      });
      return c.json({ run: updated });
    } catch (error) {
      dependencies.logError(`Failed to reject run ${id}`, error);
      return badRequest(c, errorMessage(error));
    }
  });

  app.post("/api/runs/:id/revise", async (c) => {
    const id = c.req.param("id");
    try {
      const input = reviseRequestSchema.parse(await optionalJson(c));
      const settings = await dependencies.loadSettings();
      const store = dependencies.createStore(settings);
      const updated = await dependencies.executor.mutate(id, async () => {
        const run = await store.load(id);
        await authorize(run, store, [{ capability: "revision", provider: input.provider }]);
        const context = await dependencies.buildContext(settings, store, run, "revision");
        return reviseRun(run, context, input.instruction);
      });
      return c.json({ run: updated });
    } catch (error) {
      dependencies.logError(`Failed to revise run ${id}`, error);
      return badRequest(c, errorMessage(error));
    }
  });

  app.post("/api/runs/:id/regenerate", async (c) => {
    const id = c.req.param("id");
    try {
      const input = providerRequestSchema.parse(await optionalJson(c));
      const settings = await dependencies.loadSettings();
      const store = dependencies.createStore(settings);
      const updated = await dependencies.executor.mutate(id, async () => {
        const run = await store.load(id);
        const capability = run.status === "gate_a5" ? "image" : "video";
        await authorize(run, store, [{ capability, provider: input.provider }]);
        const context = await dependencies.buildContext(settings, store, run);
        const prepared = await prepRegenerate(run, context);
        dependencies.executor.start(prepared, context);
        return prepared;
      });
      return c.json({ run: updated }, 202);
    } catch (error) {
      dependencies.logError(`Failed to regenerate run ${id}`, error);
      return badRequest(c, errorMessage(error));
    }
  });

  app.post("/api/runs/:id/resume", async (c) => {
    const id = c.req.param("id");
    try {
      const input = providerRequestSchema.parse(await optionalJson(c));
      const settings = await dependencies.loadSettings();
      const store = dependencies.createStore(settings);
      const run = await store.load(id);
      const capabilityByStatus: Partial<Record<typeof run.status, ProviderCapability>> = {
        directing: "concept",
        imaging: "image",
        animating: "video",
        captioning: "caption",
      };
      const capability = capabilityByStatus[run.status];
      if (capability) await authorize(run, store, [{ capability, provider: input.provider }]);
      const directorCapability =
        capability === "concept" || capability === "caption" ? capability : undefined;
      const context = await dependencies.buildContext(settings, store, run, directorCapability);
      const { started } = dependencies.executor.start(run, context);
      return c.json({ run, started }, 202);
    } catch (error) {
      dependencies.logError(`Failed to resume run ${id}`, error);
      return badRequest(c, errorMessage(error));
    }
  });

  app.post("/api/runs/:id/recover", async (c) => {
    const id = c.req.param("id");
    try {
      const settings = await dependencies.loadSettings();
      const store = dependencies.createStore(settings);
      const recovered = await dependencies.executor.mutate(id, async () => {
        const run = await store.load(id);
        const context = await dependencies.buildContext(settings, store, run);
        return recoverRun(run, context);
      });
      return c.json({ run: recovered }, 202);
    } catch (error) {
      dependencies.logError(`Failed to recover run ${id}`, error);
      return badRequest(c, errorMessage(error));
    }
  });
}
