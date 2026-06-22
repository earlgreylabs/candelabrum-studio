import { resolve } from "node:path";
import { loadSettings, loadStyle, type Settings } from "@/core/config";
import { RunExecutor } from "@/core/executor";
import type { PipelineContext } from "@/core/pipeline";
import { type ProviderCapability, selectedProvider } from "@/core/provider-selection";
import { isGate, isTerminal, type Run, recordRunFailure } from "@/core/run";
import { RunStore } from "@/core/store";
import { resolveDirector } from "@/providers/director";
import { resolveExporter } from "@/providers/export";
import { resolveImage } from "@/providers/image";
import { resolveVideo } from "@/providers/video";
import type { ServerDependencies } from "@/server/contracts";

const CONFIG_DIR = resolve(process.cwd(), "config");

async function buildContext(
  settings: Settings,
  store: RunStore,
  run: Run,
  directorCapability: ProviderCapability = run.status === "directing" ? "concept" : "finalise",
): Promise<PipelineContext> {
  const selectedDirector = selectedProvider(run.providerSelections, settings, directorCapability);
  return {
    settings,
    store,
    director: resolveDirector(
      settings,
      selectedDirector === "draft" ? settings.providers.director : selectedDirector,
    ),
    image: resolveImage(settings, selectedProvider(run.providerSelections, settings, "image")),
    video: resolveVideo(settings, selectedProvider(run.providerSelections, settings, "video")),
    export: resolveExporter(),
    style: run.style ? await loadStyle(CONFIG_DIR, run.style) : undefined,
    log: (message) => console.log(`[Dashboard API] ${message}`),
    notify: (title, message) => {
      Bun.spawn(["osascript", "-e", `display notification "${message}" with title "${title}"`], {
        stdout: "ignore",
        stderr: "ignore",
      });
    },
  };
}

export const productionDependencies: ServerDependencies = {
  executor: new RunExecutor(),
  loadSettings: () => loadSettings(CONFIG_DIR),
  createStore: (settings) => new RunStore(settings.paths.runs),
  buildContext,
  sleep: Bun.sleep,
  logError: (message, error) => console.error(`${message}:`, error),
};

export function canAutoResume(run: Run, settings: Settings): boolean {
  if (run.lastError) return false;
  if (["upscaling", "interpolating", "exporting"].includes(run.status)) return true;
  if (run.status === "imaging") {
    return selectedProvider(run.providerSelections, settings, "image") === "manual";
  }
  if (run.status === "animating") {
    return (
      Boolean(run.artifacts.providerJobId) ||
      selectedProvider(run.providerSelections, settings, "video") === "manual"
    );
  }
  if (run.status === "captioning") {
    return selectedProvider(run.providerSelections, settings, "caption") === "draft";
  }
  return false;
}

export async function resumeInterruptedRuns(dependencies: ServerDependencies): Promise<number> {
  const settings = await dependencies.loadSettings();
  const store = dependencies.createStore(settings);
  const runs = await store.list();
  const interrupted = runs.filter((run) => !isGate(run.status) && !isTerminal(run.status));
  let resumed = 0;

  for (const run of interrupted) {
    if (!canAutoResume(run, settings)) {
      if (!run.lastError) {
        recordRunFailure(
          run,
          new Error("Restart interrupted a model-backed stage; authorize a retry to resubmit it"),
        );
        await store.save(run);
      }
      continue;
    }
    try {
      const context = await dependencies.buildContext(settings, store, run);
      if (dependencies.executor.start(run, context).started) resumed += 1;
    } catch (error) {
      dependencies.logError(`Could not resume run ${run.id}`, error);
      recordRunFailure(run, error);
      await store.save(run);
    }
  }
  return resumed;
}
