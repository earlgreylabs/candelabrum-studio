/**
 * Resolves the configured director provider into a DirectorLLM. The Claude model
 * id is pinned here (not in TOML), per the standing stack preference; the
 * provider name in settings selects the adapter. The API key is read lazily by
 * the AI SDK at request time from a gitignored .env (ANTHROPIC_API_KEY).
 */

import { anthropic } from "@ai-sdk/anthropic";
import type { Settings } from "@/core/config";
import { ProviderRegistry } from "@/core/factory";
import type { DirectorLLM } from "@/core/providers";
import { createClaudeDirector } from "@/providers/llm/director-claude";

export const directorRegistry = new ProviderRegistry<DirectorLLM>("director");

directorRegistry.register("claude", () => {
  // Read model ID from environment, fallback to standing stack preference
  const modelId = process.env.DIRECTOR_MODEL || "claude-opus-4-8";
  return createClaudeDirector(anthropic(modelId));
});

export function resolveDirector(settings: Settings): DirectorLLM {
  return directorRegistry.resolve(settings.providers.director);
}
