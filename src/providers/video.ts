import type { Settings } from "@/core/config";
import { ProviderRegistry } from "@/core/factory";
import type { VideoProvider } from "@/core/providers";
import { ManualInboxVideoProvider } from "@/providers/video/manual-inbox";
import { VeoVideoProvider } from "@/providers/video/veo";

export const videoRegistry = new ProviderRegistry<VideoProvider>("video");

videoRegistry.register("manual", () => new ManualInboxVideoProvider());

videoRegistry.register("veo", () => {
  // Veo 3.1 by default; override via VIDEO_MODEL. Must support image-to-video (the
  // `-fast` and 3.0 models reject the base image). Direct REST call, so we pass the
  // model id + key rather than an AI SDK model object.
  const modelId = process.env.VIDEO_MODEL || "veo-3.1-generate-preview";
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for the Veo video provider");
  }
  return new VeoVideoProvider(modelId, apiKey);
});

export function resolveVideo(settings: Settings): VideoProvider {
  return videoRegistry.resolve(settings.providers.video);
}
