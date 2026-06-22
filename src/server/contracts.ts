import type { Settings } from "@/core/config";
import type { RunExecutor } from "@/core/executor";
import type { PipelineContext } from "@/core/pipeline";
import type { ProviderCapability } from "@/core/provider-selection";
import type { Run } from "@/core/run";
import type { RunStore } from "@/core/store";

/** Runtime seams required by the HTTP app. Production and tests provide these. */
export interface ServerDependencies {
  executor: RunExecutor;
  loadSettings: () => Promise<Settings>;
  createStore: (settings: Settings) => RunStore;
  buildContext: (
    settings: Settings,
    store: RunStore,
    run: Run,
    directorCapability?: ProviderCapability,
  ) => Promise<PipelineContext>;
  sleep: (milliseconds: number) => Promise<void>;
  logError: (message: string, error: unknown) => void;
}
