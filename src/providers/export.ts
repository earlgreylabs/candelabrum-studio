import type { Exporter } from "@/core/providers";
import { FfmpegExporter } from "@/providers/export/ffmpeg-exporter";

export function resolveExporter(): Exporter {
  // Always return local ffmpeg exporter for now
  return new FfmpegExporter();
}
