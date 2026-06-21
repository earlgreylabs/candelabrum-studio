import type { Settings } from "@/core/config";
import { ProviderRegistry } from "@/core/factory";
import type { ImageProvider } from "@/core/providers";
import { ManualInboxImageProvider } from "@/providers/image/manual-inbox";

export const imageRegistry = new ProviderRegistry<ImageProvider>("image");

imageRegistry.register("manual", () => new ManualInboxImageProvider());

export function resolveImage(settings: Settings): ImageProvider {
  return imageRegistry.resolve(settings.providers.image);
}
