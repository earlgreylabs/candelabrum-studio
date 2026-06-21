/**
 * Shared pipeline plumbing: the context every stage receives and the stage
 * signature. Kept separate so stages and the orchestrator share types without a
 * dependency cycle.
 */

import type { Settings, Style } from "@/core/config";
import type { DirectorLLM, Exporter, ImageProvider, VideoProvider } from "@/core/providers";
import type { Run } from "@/core/run";
import type { RunStore } from "@/core/store";

export interface PipelineContext {
  settings: Settings;
  store: RunStore;
  /** The creative director adapter, used by the direct stage. */
  director: DirectorLLM;
  /** The image generator adapter, used by the image stage. */
  image: ImageProvider;
  /** The video generator adapter, used by the animate stage. */
  video: VideoProvider;
  /** The packaging adapter, used by the export stage. */
  export: Exporter;
  /** The active style preset, if the run was created with one. */
  style?: Style;
  log: (message: string) => void;
}

/**
 * A stage advances a run by producing its artifact and mutating the run in place
 * (artifacts, shotSpec, cost). It does not change `status`; the orchestrator owns
 * transitions so persistence and the event log stay uniform.
 */
export type Stage = (run: Run, ctx: PipelineContext) => Promise<void>;
