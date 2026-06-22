function legacyImageModel(prefix: string): string | undefined {
  const legacy = process.env.IMAGE_MODEL;
  return legacy?.startsWith(prefix) ? legacy : undefined;
}

export function falImageModelId(): string {
  return process.env.FAL_IMAGE_MODEL || legacyImageModel("fal-") || "fal-ai/flux/dev";
}

export function geminiImageModelId(): string {
  return process.env.GEMINI_IMAGE_MODEL || legacyImageModel("gemini-") || "gemini-3.1-flash-image";
}

export function veoVideoModelId(): string {
  return process.env.VEO_VIDEO_MODEL || process.env.VIDEO_MODEL || "veo-3.1-generate-preview";
}

export function waveSpeedVideoModelId(): string {
  return process.env.WAVESPEED_VIDEO_MODEL || "kwaivgi/kling-v1.6-i2v-standard";
}
