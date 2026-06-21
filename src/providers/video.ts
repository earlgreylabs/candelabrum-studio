import type { Settings } from "@/core/config";
import { ProviderRegistry } from "@/core/factory";
import type { VideoProvider } from "@/core/providers";
import { ManualInboxVideoProvider } from "@/providers/video/manual-inbox";

export const videoRegistry = new ProviderRegistry<VideoProvider>("video");

videoRegistry.register("manual", () => new ManualInboxVideoProvider());

export function resolveVideo(settings: Settings): VideoProvider {
  return videoRegistry.resolve(settings.providers.video);
}
