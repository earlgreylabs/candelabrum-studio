/**
 * The stage registry: the handler for each non-gate, non-terminal status. The
 * orchestrator looks stages up here, so swapping a stub for a real stage is a
 * one-line change in this file.
 */

import type { Stage } from "@/core/pipeline";
import type { RunStatus } from "@/core/run";
import { animate } from "@/stages/animate";
import { caption } from "@/stages/caption";
import { direct } from "@/stages/direct";
import { exportPackage } from "@/stages/export";
import { image } from "@/stages/image";
import { interpolate } from "@/stages/interpolate";

export const STAGES: Partial<Record<RunStatus, Stage>> = {
  directing: direct,
  imaging: image,
  animating: animate,
  interpolating: interpolate,
  captioning: caption,
  exporting: exportPackage,
};
