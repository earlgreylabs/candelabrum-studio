import type { Settings } from "@/core/config";
import type { ImageProvider } from "@/core/providers";
import { ManualInboxImageProvider } from "@/providers/image/manual-inbox";

export function resolveImage(settings: Settings): ImageProvider {
  if (settings.providers.image === "manual") {
    return new ManualInboxImageProvider();
  }
  throw new Error(`unknown image provider: ${settings.providers.image}`);
}
