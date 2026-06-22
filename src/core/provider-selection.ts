import { z } from "zod";
import type { Settings } from "@/core/config";

export const PROVIDER_CAPABILITIES = [
  "concept",
  "revision",
  "finalise",
  "image",
  "video",
  "caption",
] as const;
export type ProviderCapability = (typeof PROVIDER_CAPABILITIES)[number];

export const DIRECTOR_CAPABILITIES = ["concept", "revision", "finalise", "caption"] as const;
export type DirectorCapability = (typeof DIRECTOR_CAPABILITIES)[number];

export const providerSelectionsSchema = z.object({
  concept: z.string().min(1).optional(),
  revision: z.string().min(1).optional(),
  finalise: z.string().min(1).optional(),
  image: z.string().min(1).optional(),
  video: z.string().min(1).optional(),
  caption: z.string().min(1).optional(),
});
export type ProviderSelections = z.infer<typeof providerSelectionsSchema>;

export function defaultProviderFor(settings: Settings, capability: ProviderCapability): string {
  if (capability === "image") return settings.providers.image;
  if (capability === "video") return settings.providers.video;
  return settings.providers.director;
}

export function selectedProvider(
  selections: ProviderSelections,
  settings: Settings,
  capability: ProviderCapability,
): string {
  return selections[capability] ?? defaultProviderFor(settings, capability);
}
