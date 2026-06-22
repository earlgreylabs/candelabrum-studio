import { fal } from "@ai-sdk/fal";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import type { Settings } from "@/core/config";
import { ProviderRegistry } from "@/core/factory";
import type { ImageProvider } from "@/core/providers";
import { FalImageProvider } from "@/providers/image/fal";
import { GeminiImageProvider } from "@/providers/image/gemini";
import { ManualInboxImageProvider } from "@/providers/image/manual-inbox";
import { WaveSpeedImageProvider } from "@/providers/image/wavespeed";
import { falImageModelId, geminiImageModelId } from "@/providers/model-config";

export const imageRegistry = new ProviderRegistry<ImageProvider>("image");

imageRegistry.register("manual", () => new ManualInboxImageProvider());

imageRegistry.register("fal", () => {
  // Model id from .env, defaulting to FLUX.1 [dev] (the cheap automated tier).
  const modelId = falImageModelId();
  return new FalImageProvider(fal.image(modelId));
});

imageRegistry.register("gemini", () => {
  // "Nano Banana 2"; override via IMAGE_MODEL. gemini-2.5-flash-image is prior gen.
  const modelId = geminiImageModelId();
  // Single key var (the AI Studio name), passed explicitly to the AI SDK.
  const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
  return new GeminiImageProvider(google(modelId));
});

imageRegistry.register("wavespeed", () => {
  const apiKey = process.env.WAVESPEED_API_KEY;
  if (!apiKey) {
    throw new Error("WAVESPEED_API_KEY is required to use the wavespeed image provider");
  }
  return new WaveSpeedImageProvider(apiKey);
});

export function resolveImage(settings: Settings, override?: string): ImageProvider {
  return imageRegistry.resolve(override || settings.providers.image);
}
