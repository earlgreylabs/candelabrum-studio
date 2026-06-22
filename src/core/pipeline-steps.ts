import type { Run, RunStatus } from "@/core/run";

export const PIPELINE_STEP_IDS = [
  "direct",
  "gate-a",
  "image",
  "gate-a5",
  "upscale",
  "animate",
  "interpolate",
  "gate-b",
  "caption",
  "export",
] as const;
export type PipelineStepId = (typeof PIPELINE_STEP_IDS)[number];

export interface PipelineStepDefinition {
  id: PipelineStepId;
  label: string;
  kind: "stage" | "gate";
  statuses: readonly RunStatus[];
  description: string;
  input: string;
  output: string;
  cost: string;
}

export const PIPELINE_STEPS: readonly PipelineStepDefinition[] = [
  {
    id: "direct",
    label: "Direct",
    kind: "stage",
    statuses: ["directing"],
    description: "The director proposes distinct concepts from the style and optional lore.",
    input: "Style preset, lore, and recent concept context.",
    output: "A concept draft for operator review.",
    cost: "Invokes the selected concept model after explicit authorization.",
  },
  {
    id: "gate-a",
    label: "Gate A",
    kind: "gate",
    statuses: ["gate_a"],
    description: "Review, revise, approve, or reject the proposed concept.",
    input: "Concept draft and any operator revision instruction.",
    output: "An approved concept ready for prompt finalization.",
    cost: "Review is free. Revision and approval can authorize model-backed operations.",
  },
  {
    id: "image",
    label: "Image",
    kind: "stage",
    statuses: ["imaging"],
    description: "Generate the composition-locking base still from the shot specification.",
    input: "Image prompt, orientation, style, and optional seed hint.",
    output: "A base image and resolved seed.",
    cost: "Uses the image provider selected at Gate A or Gate A.5.",
  },
  {
    id: "gate-a5",
    label: "Gate A.5",
    kind: "gate",
    statuses: ["gate_a5"],
    description: "Approve the base image before the more expensive animation step.",
    input: "Rendered base image.",
    output: "An approved image, or an explicitly authorized re-roll.",
    cost: "Review is free. Re-roll and animation actions show their provider before spending.",
  },
  {
    id: "upscale",
    label: "Upscale",
    kind: "stage",
    statuses: ["upscaling"],
    description: "Optionally enhance image resolution before animation.",
    input: "Approved base image.",
    output: "An enhanced image or an explicit pass-through.",
    cost: "Currently uses local tooling and does not submit a cloud model request.",
  },
  {
    id: "animate",
    label: "Animate",
    kind: "stage",
    statuses: ["animating"],
    description: "Turn the approved still into a short motion clip.",
    input: "Approved image and motion prompt.",
    output: "A raw provider clip and resumable remote job metadata.",
    cost: "Uses the video provider selected at Gate A.5 or Gate B.",
  },
  {
    id: "interpolate",
    label: "Interpolate",
    kind: "stage",
    statuses: ["interpolating"],
    description: "Create a smooth local master, or pass through when no usable GPU is available.",
    input: "Raw provider clip.",
    output: "A high-frame-rate master and review proxy.",
    cost: "Runs locally and does not submit a cloud model request.",
  },
  {
    id: "gate-b",
    label: "Gate B",
    kind: "gate",
    statuses: ["gate_b"],
    description: "Review the finished clip, edit its caption, approve, re-run, or reject it.",
    input: "Master clip, safe-zone context, and caption draft.",
    output: "An approved clip and caption choice.",
    cost: "Review is free. Video re-run and optional caption generation require authorization.",
  },
  {
    id: "caption",
    label: "Caption",
    kind: "stage",
    statuses: ["captioning"],
    description: "Finalize platform-ready caption text, unless the edited draft is retained.",
    input: "Approved shot specification and caption draft.",
    output: "Final caption and hashtags.",
    cost: "Optional model call selected at Gate B; retaining the edited draft costs nothing.",
  },
  {
    id: "export",
    label: "Export",
    kind: "stage",
    statuses: ["exporting", "ready"],
    description: "Assemble the approved master, caption, and metadata into the ready package.",
    input: "Approved master, caption, output profile, and export options.",
    output: "A ready export package for manual publishing or editor handoff.",
    cost: "Runs locally and does not submit a cloud model request.",
  },
] as const;

function effectiveStatus(run: Run): RunStatus {
  if (run.lastError) return run.lastError.status;
  if (run.status === "rejected" || run.status === "failed") {
    const terminalEvent = run.events.findLast((event) => event.to === run.status);
    if (terminalEvent?.from) return terminalEvent.from;
  }
  return run.status;
}

export function currentPipelineStepIndex(run: Run): number {
  const status = effectiveStatus(run);
  const index = PIPELINE_STEPS.findIndex((step) => step.statuses.includes(status));
  return index >= 0 ? index : 0;
}
