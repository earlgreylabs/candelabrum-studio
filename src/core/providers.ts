/**
 * Adapter interfaces. Each stage depends on an interface here, never a vendor;
 * swapping a provider (or substituting a `ManualInbox`) is config, not code.
 *
 * Only `DirectorLLM` is realised so far (Slice 2). `ImageProvider`,
 * `VideoProvider`, and `Exporter` land with their stages, behind the same
 * pattern (see docs/concept/02-architecture.md).
 */

import type { Style } from "@/core/config";
import type { Orientation } from "@/core/constants";
import type { Concept, Run, ShotSpec } from "@/core/run";

export type Platform = "tiktok" | "instagram";

export interface ProposeConceptsInput {
  count: number;
  style?: Style;
  /** Optional campaign directive for serialised, sequential concepts. */
  lore?: string;
  /** Recent concept summaries, so the director avoids repeating itself. */
  history?: string[];
}

/**
 * The creative director. Realised through the Vercel AI SDK provider
 * abstraction, so Claude-versus-Gemini is a config swap, not a code change.
 */
export interface DirectorLLM {
  /** The model id driving the director's LLM steps, for cost tracking. */
  readonly modelId: string;
  proposeConcepts(
    input: ProposeConceptsInput,
    onPayload?: (payload: any) => void,
  ): Promise<Concept[]>;
  revise(
    concept: Concept,
    instruction: string,
    onPayload?: (payload: any) => void,
  ): Promise<Concept>;
  finalise(
    concept: Concept,
    orientation: Orientation,
    style?: Style,
    onPayload?: (payload: any) => void,
  ): Promise<ShotSpec>;
  caption(
    shotSpec: ShotSpec,
    platform: Platform,
    onPayload?: (payload: any) => void,
  ): Promise<string>;
}

export interface ImageArtifact {
  path: string;
  seed: number | undefined;
  provider: string;
  model: string;
  costUsd: number;
  payload?: any;
}

export interface ImageProvider {
  generate(runId: string, runDir: string, spec: ShotSpec): Promise<ImageArtifact>;
}

export interface VideoArtifact {
  path: string;
  provider: string;
  model: string;
  costUsd: number;
  payload?: any;
}

export interface VideoProvider {
  animate(
    runId: string,
    renderDir: string,
    spec: ShotSpec,
    baseImagePath: string,
    onPayload?: (payload: any) => void,
    existingJobId?: string,
    onJobId?: (jobId: string) => Promise<void>,
  ): Promise<VideoArtifact>;
}

export interface ExportPackage {
  dir: string;
  video: string;
}

export interface Exporter {
  package(run: Run, readyDir: string): Promise<ExportPackage>;
}
