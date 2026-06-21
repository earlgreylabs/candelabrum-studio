/**
 * The Run: the unit of work and the unit of resumption. `status` is the single
 * source of "where this run is" and drives resume; there is no second progress
 * flag to drift out of sync. State is validated with Zod at the disk boundary.
 */

import { z } from "zod";
import type { Settings } from "@/core/config";
import { orientationSchema, outputProfileSchema } from "@/core/config";
import type { Orientation } from "@/core/constants";

/**
 * Linear pipeline position: six stages, three human gates (A concept, A.5 base
 * image, B clip), and terminal states. Ordering here is the topology.
 */
export const RUN_STATUSES = [
  "directing", // stage 1: director proposes a shot spec
  "gate_a", // human: approve the concept
  "imaging", // stage 2: render the base still
  "gate_a5", // human: approve the base image (cheap re-roll before video spend)
  "upscaling", // stage 2.5: AI upscaling for crispness
  "animating", // stage 3: image -> video (async)
  "interpolating", // stage 4: local GPU -> high-fps master
  "gate_b", // human: approve the finished clip
  "captioning", // stage 5: finalise caption
  "exporting", // stage 6: assemble the export package
  "ready", // terminal: v1 output assembled (manual post from here)
  "rejected", // terminal: operator discarded the run
  "failed", // terminal: unrecoverable error
] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const GATE_STATUSES = ["gate_a", "gate_a5", "gate_b"] as const satisfies RunStatus[];
export const TERMINAL_STATUSES = ["ready", "rejected", "failed"] as const satisfies RunStatus[];

/** The linear next position from each status. Gates advance only on operator action. */
export const NEXT_STATUS: Record<RunStatus, RunStatus | null> = {
  directing: "gate_a",
  gate_a: "imaging",
  imaging: "gate_a5",
  gate_a5: "upscaling",
  upscaling: "animating",
  animating: "interpolating",
  interpolating: "gate_b",
  gate_b: "captioning",
  captioning: "exporting",
  exporting: "ready",
  ready: null,
  rejected: null,
  failed: null,
};

export function isGate(status: RunStatus): boolean {
  return (GATE_STATUSES as readonly RunStatus[]).includes(status);
}

export function isTerminal(status: RunStatus): boolean {
  return (TERMINAL_STATUSES as readonly RunStatus[]).includes(status);
}

export const runStatusSchema = z.enum(RUN_STATUSES);

export const conceptSchema = z.object({
  title: z.string(),
  summary: z.string(),
  subject: z.string(),
});
export type Concept = z.infer<typeof conceptSchema>;

export const shotSpecSchema = z.object({
  imagePrompt: z.string(),
  motionPrompt: z.string(),
  captionDraft: z.string(),
  style: z.string(),
  orientation: orientationSchema,
  seedHint: z.number().optional(),
});
export type ShotSpec = z.infer<typeof shotSpecSchema>;

const runArtifactsSchema = z.object({
  image: z.string().optional(),
  upscaledImage: z.string().optional(),
  rawClip: z.string().optional(),
  masterClip: z.string().optional(),
  masterProxyClip: z.string().optional(),
  providerJobId: z.string().optional(),
  exportPackage: z.string().optional(),
  exportVideo: z.string().optional(),
});

const runEventSchema = z.object({
  at: z.string(),
  type: z.string(),
  from: runStatusSchema.optional(),
  to: runStatusSchema.optional(),
  note: z.string().optional(),
});
export type RunEvent = z.infer<typeof runEventSchema>;

const overridesSchema = z.object({
  imageProvider: z.string().optional(),
  videoProvider: z.string().optional(),
});

const costEntrySchema = z.object({
  stage: z.string(),
  provider: z.string(),
  // The specific model / tool used for the step (e.g. "claude-opus-4-8",
  // "gemini-3.1-flash-image", "veo-3.0-fast-generate-001", "ffmpeg"). Optional so
  // runs created before model tracking still load.
  model: z.string().optional(),
  amountUsd: z.number(),
  payload: z.any().optional(),
});

export const runSchema = z.object({
  id: z.string(),
  style: z.string().optional(),
  lore: z.string().optional(),
  status: runStatusSchema,
  concept: conceptSchema.optional(),
  shotSpec: shotSpecSchema.optional(),
  profile: outputProfileSchema,
  artifacts: runArtifactsSchema,
  events: z.array(runEventSchema),
  cost: z.array(costEntrySchema),
  overrides: overridesSchema.optional(),
  createdAt: z.string(),
});
export type Run = z.infer<typeof runSchema>;

function genRunId(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${stamp}-${crypto.randomUUID().slice(0, 4)}`;
}

export interface CreateRunOptions {
  orientation: Orientation;
  style?: string;
  lore?: string;
}

export function createRun(settings: Settings, opts: CreateRunOptions): Run {
  const now = new Date();
  return runSchema.parse({
    id: genRunId(now),
    style: opts.style,
    lore: opts.lore,
    status: "directing",
    profile: settings.profiles[opts.orientation],
    artifacts: {},
    events: [{ at: now.toISOString(), type: "create", to: "directing" }],
    cost: [],
    createdAt: now.toISOString(),
  });
}

/** Record a transition in the event log and move the run's status. */
export function transition(run: Run, to: RunStatus, type: string, note?: string): void {
  run.events.push({ at: new Date().toISOString(), type, from: run.status, to, note });
  run.status = to;
}
