import { describe, expect, test } from "bun:test";
import { loadSettings } from "@/core/config";
import { currentPipelineStepIndex, PIPELINE_STEPS } from "@/core/pipeline-steps";
import { createRun, type RunStatus, transition } from "@/core/run";

describe("pipeline step metadata", () => {
  test("covers every non-terminal run status", () => {
    const covered = new Set(PIPELINE_STEPS.flatMap((step) => step.statuses));
    const pipelineStatuses: RunStatus[] = [
      "directing",
      "gate_a",
      "imaging",
      "gate_a5",
      "upscaling",
      "animating",
      "interpolating",
      "gate_b",
      "captioning",
      "exporting",
      "ready",
    ];
    for (const status of pipelineStatuses) {
      expect(covered.has(status)).toBe(true);
    }
  });

  test("keeps a rejected run on the step where rejection occurred", async () => {
    const settings = await loadSettings("./config");
    const run = createRun(settings, { orientation: "portrait" });
    transition(run, "gate_a", "stage");
    transition(run, "rejected", "operator");
    expect(PIPELINE_STEPS[currentPipelineStepIndex(run)]?.id).toBe("gate-a");
  });
});
