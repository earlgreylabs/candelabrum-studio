/**
 * Resolves the configured director provider into a DirectorLLM. The Claude model
 * id is pinned here (not in TOML), per the standing stack preference; the
 * provider name in settings selects the adapter. The API key is read lazily by
 * the AI SDK at request time from a gitignored .env (ANTHROPIC_API_KEY).
 */

import { anthropic } from "@ai-sdk/anthropic";
import type { Settings } from "@/core/config";
import type { DirectorLLM } from "@/core/providers";
import { createClaudeDirector } from "@/providers/llm/director-claude";

export const DIRECTOR_MODEL_ID = "claude-opus-4-8";

export function resolveDirector(settings: Settings): DirectorLLM {
  if (settings.providers.director === "claude") {
    return createClaudeDirector(anthropic(DIRECTOR_MODEL_ID));
  }
  throw new Error(`unknown director provider: ${settings.providers.director}`);
}
