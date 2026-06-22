import { describe, expect, test } from "bun:test";
import { loadSettings } from "@/core/config";
import { authorizeProvider, createRun, isGate, isTerminal, NEXT_STATUS } from "@/core/run";

describe("run model", () => {
  test("gate and terminal predicates", () => {
    expect(isGate("gate_a")).toBe(true);
    expect(isGate("imaging")).toBe(false);
    expect(isTerminal("ready")).toBe(true);
    expect(isTerminal("gate_b")).toBe(false);
  });

  test("status topology runs linearly to ready", () => {
    expect(NEXT_STATUS.directing).toBe("gate_a");
    expect(NEXT_STATUS.gate_a5).toBe("upscaling");
    expect(NEXT_STATUS.upscaling).toBe("animating");
    expect(NEXT_STATUS.exporting).toBe("ready");
    expect(NEXT_STATUS.ready).toBeNull();
  });

  test("createRun starts at directing with the orientation's profile", async () => {
    const settings = await loadSettings("./config");
    const run = createRun(settings, { orientation: "landscape", style: "cosmic-scifi" });
    expect(run.status).toBe("directing");
    expect(run.profile.orientation).toBe("landscape");
    expect(run.profile.aspect).toBe("16:9");
    expect(run.events[0]?.type).toBe("create");
  });

  test("switching video providers does not reuse another provider's remote job", async () => {
    const settings = await loadSettings("./config");
    const run = createRun(settings, { orientation: "portrait" });
    run.providerSelections.video = "veo";
    run.artifacts.providerJobId = "operations/veo-job";

    authorizeProvider(run, "video", "fal-kling");

    expect(run.providerSelections.video).toBe("fal-kling");
    expect(run.artifacts.providerJobId).toBeUndefined();
  });
});
