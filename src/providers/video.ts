import type { Settings } from "@/core/config";
import { ProviderRegistry } from "@/core/factory";
import type { VideoProvider } from "@/core/providers";
import { veoVideoModelId, waveSpeedVideoModelId } from "@/providers/model-config";
import { type FalVideoModel, FalVideoProvider } from "@/providers/video/fal";
import { ManualInboxVideoProvider } from "@/providers/video/manual-inbox";
import { VeoVideoProvider } from "@/providers/video/veo";
import { WaveSpeedVideoProvider } from "@/providers/video/wavespeed";

export const videoRegistry = new ProviderRegistry<VideoProvider>("video");

videoRegistry.register("manual", () => new ManualInboxVideoProvider());

for (const model of ["cosmos", "seedance", "kling"] as const satisfies FalVideoModel[]) {
  videoRegistry.register(`fal-${model}`, () => {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      throw new Error("FAL_KEY is required for fal.ai video providers");
    }
    return new FalVideoProvider(model, apiKey);
  });
}

videoRegistry.register("veo", () => {
  // Veo 3.1 by default; override via VIDEO_MODEL. Must support image-to-video (the
  // `-fast` and 3.0 models reject the base image). Direct REST call, so we pass the
  // model id + key rather than an AI SDK model object.
  const modelId = veoVideoModelId();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is required for the Veo video provider");
  }
  return new VeoVideoProvider(modelId, apiKey);
});

videoRegistry.register("wavespeed", () => {
  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) {
    throw new Error("WAVESPEED_API_KEY is required to use the wavespeed video provider");
  }
  return new WaveSpeedVideoProvider(apiKey, waveSpeedVideoModelId());
});

export function resolveVideo(settings: Settings, override?: string): VideoProvider {
  return videoRegistry.resolve(override || settings.providers.video);
}
