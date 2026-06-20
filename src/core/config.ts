/**
 * Typed configuration: TOML on disk, validated with Zod at load. Human-edited
 * settings and style presets; secrets never live here (see .env).
 */

import { resolve } from "node:path";
import { parse as parseToml } from "smol-toml";
import { z } from "zod";
import { MASTER_FPS_DEFAULT, ORIENTATIONS } from "@/core/constants";

export const orientationSchema = z.enum(ORIENTATIONS);

/** Pixel insets into the delivery frame to keep key content clear of. */
const safeZoneSchema = z.object({
  top: z.number().int().nonnegative(),
  right: z.number().int().nonnegative(),
  bottom: z.number().int().nonnegative(),
  left: z.number().int().nonnegative(),
});

export const outputProfileSchema = z.object({
  orientation: orientationSchema,
  aspect: z.string(),
  deliveryWidth: z.number().int().positive(),
  deliveryHeight: z.number().int().positive(),
  fpsCap: z.number().int().positive(),
  safeZone: safeZoneSchema,
});
export type OutputProfile = z.infer<typeof outputProfileSchema>;

const pathsSchema = z.object({
  runs: z.string().min(1),
  renders: z.string().min(1),
  ready: z.string().min(1),
});

const providersSchema = z.object({
  director: z.string().min(1),
  image: z.string().min(1),
  video: z.string().min(1),
});

const targetsSchema = z.object({
  masterFps: z.number().int().positive().default(MASTER_FPS_DEFAULT),
  pollIntervalSeconds: z.number().int().positive().default(15),
});

export const settingsSchema = z.object({
  paths: pathsSchema,
  providers: providersSchema,
  targets: targetsSchema,
  profiles: z.object({
    portrait: outputProfileSchema,
    landscape: outputProfileSchema,
  }),
});
export type Settings = z.infer<typeof settingsSchema>;

export const styleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  prompt: z.object({
    imageScaffold: z.string().min(1),
    motionScaffold: z.string().min(1),
    negative: z.string().optional(),
  }),
  caption: z.object({
    tiktok: z.string().min(1),
    instagram: z.string().min(1),
  }),
});
export type Style = z.infer<typeof styleSchema>;

async function loadToml(path: string): Promise<unknown> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new Error(`config file not found: ${path}`);
  }
  return parseToml(await file.text());
}

export async function loadSettings(configDir: string): Promise<Settings> {
  const raw = await loadToml(resolve(configDir, "settings.toml"));
  return settingsSchema.parse(raw);
}

export async function loadStyle(configDir: string, id: string): Promise<Style> {
  const raw = await loadToml(resolve(configDir, "styles", `${id}.toml`));
  return styleSchema.parse(raw);
}
