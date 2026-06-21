import type { Settings } from "@/core/config";
import type { VideoProvider } from "@/core/providers";
import { ManualInboxVideoProvider } from "@/providers/video/manual-inbox";

export function resolveVideo(settings: Settings): VideoProvider {
  if (settings.providers.video === "manual") {
    return new ManualInboxVideoProvider();
  }
  throw new Error(`unknown video provider: ${settings.providers.video}`);
}
