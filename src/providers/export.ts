import { ProviderRegistry } from "@/core/factory";
import type { Exporter } from "@/core/providers";
import { FfmpegExporter } from "@/providers/export/ffmpeg-exporter";

export const exportRegistry = new ProviderRegistry<Exporter>("export");

exportRegistry.register("ffmpeg", () => new FfmpegExporter());

export function resolveExporter(): Exporter {
  // Always return local ffmpeg exporter for now
  return exportRegistry.resolve("ffmpeg");
}
