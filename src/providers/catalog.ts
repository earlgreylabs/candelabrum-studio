import type { Settings } from "@/core/config";
import {
  defaultProviderFor,
  PROVIDER_CAPABILITIES,
  type ProviderCapability,
} from "@/core/provider-selection";
import {
  falImageModelId,
  geminiImageModelId,
  veoVideoModelId,
  waveSpeedVideoModelId,
} from "@/providers/model-config";
import { FAL_VIDEO_MODELS } from "@/providers/video/fal";

export type ProviderMode = "automated" | "manual" | "local";

export interface ProviderOption {
  id: string;
  capability: ProviderCapability;
  label: string;
  model: string;
  mode: ProviderMode;
  available: boolean;
  unavailableReason?: string;
  estimatedCostUsd?: number;
}

function credential(name: string): Pick<ProviderOption, "available" | "unavailableReason"> {
  return process.env[name]
    ? { available: true }
    : { available: false, unavailableReason: `${name} is not configured` };
}

function directorOptions(): ProviderOption[] {
  const model = process.env.DIRECTOR_MODEL || "claude-opus-4-8";
  return (["concept", "revision", "finalise", "caption"] as const).map((capability) => ({
    id: "claude",
    capability,
    label: "Claude",
    model,
    mode: "automated",
    ...credential("ANTHROPIC_API_KEY"),
  }));
}

export function listProviderOptions(): ProviderOption[] {
  return [
    ...directorOptions(),
    {
      id: "draft",
      capability: "caption",
      label: "Keep edited caption",
      model: "no model",
      mode: "local",
      available: true,
      estimatedCostUsd: 0,
    },
    {
      id: "manual",
      capability: "image",
      label: "Manual inbox",
      model: "manual",
      mode: "manual",
      available: true,
      estimatedCostUsd: 0,
    },
    {
      id: "fal",
      capability: "image",
      label: "fal",
      model: falImageModelId(),
      mode: "automated",
      estimatedCostUsd: 0.06,
      ...credential("FAL_KEY"),
    },
    {
      id: "gemini",
      capability: "image",
      label: "Gemini Image",
      model: geminiImageModelId(),
      mode: "automated",
      estimatedCostUsd: 0.04,
      ...credential("GEMINI_API_KEY"),
    },
    {
      id: "wavespeed",
      capability: "image",
      label: "WaveSpeed",
      model: "wavespeed-ai/flux-dev",
      mode: "automated",
      estimatedCostUsd: 0.03,
      ...credential("WAVESPEED_API_KEY"),
    },
    {
      id: "manual",
      capability: "video",
      label: "Manual inbox",
      model: "manual",
      mode: "manual",
      available: true,
      estimatedCostUsd: 0,
    },
    ...Object.entries(FAL_VIDEO_MODELS).map(([model, config]) => ({
      id: `fal-${model}`,
      capability: "video" as const,
      label: config.label,
      model: config.endpoint,
      mode: "automated" as const,
      estimatedCostUsd: config.estimatedCostUsd,
      ...credential("FAL_KEY"),
    })),
    {
      id: "veo",
      capability: "video",
      label: "Google Veo",
      model: veoVideoModelId(),
      mode: "automated",
      estimatedCostUsd: 1,
      ...credential("GEMINI_API_KEY"),
    },
    {
      id: "wavespeed",
      capability: "video",
      label: "WaveSpeed",
      model: waveSpeedVideoModelId(),
      mode: "automated",
      estimatedCostUsd: 0.5,
      ...credential("WAVESPEED_API_KEY"),
    },
  ];
}

export function providerOption(capability: ProviderCapability, id: string): ProviderOption {
  const option = listProviderOptions().find(
    (candidate) => candidate.capability === capability && candidate.id === id,
  );
  if (!option) throw new Error(`Provider '${id}' does not support ${capability}`);
  return option;
}

export function providerDefaults(settings: Settings): Record<ProviderCapability, string> {
  return Object.fromEntries(
    PROVIDER_CAPABILITIES.map((capability) => [
      capability,
      defaultProviderFor(settings, capability),
    ]),
  ) as Record<ProviderCapability, string>;
}
