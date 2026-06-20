/**
 * Named constants and small derivations. Platform caps are hard facts (2026
 * guidance); preferences and paths live in config/settings.toml instead.
 */

export const ORIENTATIONS = ["portrait", "landscape"] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

/** Platform display caps. Both TikTok and Instagram cap at 1080p / 60fps. */
export const DELIVERY_FPS = 60;
export const DELIVERY_MAX_HEIGHT = 1080;

/** Default archival interpolation target; overridable via settings.targets.masterFps. */
export const MASTER_FPS_DEFAULT = 120;

/**
 * Derived RIFE multiplier: how many times to multiply source frames to reach the
 * master frame rate. Derived from the provider's source fps, never hard-coded
 * (a 30fps source -> 4, a 24fps source -> 5).
 */
export function interpolationFactor(sourceFps: number, masterFps: number): number {
  return Math.ceil(masterFps / sourceFps);
}
