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
import type { ShotSpec } from "@/core/run";

/** A creative idea before it is finalised into a concrete shot spec. */
export interface Concept {
  title: string;
  summary: string;
  /** The focal subject the image and motion prompts are built around. */
  subject: string;
}

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
  proposeConcepts(input: ProposeConceptsInput): Promise<Concept[]>;
  revise(concept: Concept, instruction: string): Promise<Concept>;
  finalise(concept: Concept, orientation: Orientation, style?: Style): Promise<ShotSpec>;
  caption(shotSpec: ShotSpec, platform: Platform): Promise<string>;
}

export interface ImageArtifact {
  path: string;
  seed: number | undefined;
  provider: string;
  costUsd: number;
}

export interface ImageProvider {
  generate(runId: string, runDir: string, spec: ShotSpec): Promise<ImageArtifact>;
}

export interface VideoArtifact {
  path: string;
  provider: string;
  costUsd: number;
}

export interface VideoProvider {
  animate(
    runId: string,
    renderDir: string,
    spec: ShotSpec,
    baseImagePath: string,
  ): Promise<VideoArtifact>;
}
