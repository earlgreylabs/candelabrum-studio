/**
 * The DirectorLLM, realised over the Vercel AI SDK. Structured generation
 * (`generateObject`) keeps each stage's output schema-validated. The model is
 * injected, so a Gemini swap is a config change and tests can drive a mock model
 * with no network call or spend.
 */

import { generateObject, type LanguageModel } from "ai";
import { z } from "zod";
import type { Style } from "@/core/config";
import type { Orientation } from "@/core/constants";
import type { DirectorLLM, Platform, ProposeConceptsInput } from "@/core/providers";
import { type Concept, conceptSchema, type ShotSpec, shotSpecSchema } from "@/core/run";
import { modelIdOf } from "@/providers/model-id";

const DIRECTOR_SYSTEM =
  "You are the creative director of a digital-art studio that produces short, " +
  "highly varied fantasy and sci-fi video clips. Propose distinct, vivid concepts " +
  "and write precise generation prompts. Favour forward camera travel and stable, " +
  "non-warping structure. Keep every concept different from the recent history.";

function styleBrief(style?: Style): string {
  if (!style) {
    return "No fixed style preset; choose an evocative direction.";
  }
  return `Style "${style.name}": ${style.description}\nImage scaffold: ${style.prompt.imageScaffold}\nMotion scaffold: ${style.prompt.motionScaffold}`;
}

export function createClaudeDirector(model: LanguageModel): DirectorLLM {
  return {
    modelId: modelIdOf(model),
    async proposeConcepts(
      { count, style, lore, history }: ProposeConceptsInput,
      onPayload?: (payload: any) => void,
    ): Promise<Concept[]> {
      const messages = [
        {
          role: "system" as const,
          content: DIRECTOR_SYSTEM,
          providerOptions: {
            anthropic: { cacheControl: { type: "ephemeral" as const } },
          },
        },
        {
          role: "user" as const,
          content: [
            `Propose ${count} distinct concepts.`,
            styleBrief(style),
            lore ? `Campaign directive: ${lore}` : "",
            history?.length ? `Avoid repeating: ${history.join("; ")}` : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ];
      onPayload?.({ model: modelIdOf(model), messages });

      const { object } = await generateObject({
        model,
        allowSystemInMessages: true,
        schema: z.object({ concepts: z.array(conceptSchema) }),
        messages,
      });
      return object.concepts.slice(0, count);
    },

    async revise(
      concept: Concept,
      instruction: string,
      onPayload?: (payload: any) => void,
    ): Promise<Concept> {
      const messages = [
        {
          role: "system" as const,
          content: DIRECTOR_SYSTEM,
          providerOptions: {
            anthropic: { cacheControl: { type: "ephemeral" as const } },
          },
        },
        {
          role: "user" as const,
          content: `Revise this concept per the instruction.\n\nConcept: ${JSON.stringify(concept)}\n\nInstruction: ${instruction}`,
        },
      ];
      onPayload?.({ model: modelIdOf(model), messages });

      const { object } = await generateObject({
        model,
        allowSystemInMessages: true,
        schema: conceptSchema,
        messages,
      });
      return object;
    },

    async finalise(
      concept: Concept,
      orientation: Orientation,
      style?: Style,
      onPayload?: (payload: any) => void,
    ): Promise<ShotSpec> {
      const messages = [
        {
          role: "system" as const,
          content: DIRECTOR_SYSTEM,
          providerOptions: {
            anthropic: { cacheControl: { type: "ephemeral" as const } },
          },
        },
        {
          role: "user" as const,
          content: [
            `Finalise this concept into a ${orientation} shot.`,
            `Concept: ${JSON.stringify(concept)}`,
            styleBrief(style),
            "Write a base-image prompt, a motion prompt, and a short caption draft.",
          ].join("\n\n"),
        },
      ];
      onPayload?.({ model: modelIdOf(model), messages });

      const { object } = await generateObject({
        model,
        allowSystemInMessages: true,
        schema: z.object({
          imagePrompt: z.string(),
          motionPrompt: z.string(),
          captionDraft: z.string(),
        }),
        messages,
      });
      return shotSpecSchema.parse({
        imagePrompt: object.imagePrompt,
        motionPrompt: object.motionPrompt,
        captionDraft: object.captionDraft,
        style: style?.id ?? "none",
        orientation,
      });
    },

    async caption(
      shotSpec: ShotSpec,
      platform: Platform,
      onPayload?: (payload: any) => void,
    ): Promise<string> {
      const messages = [
        {
          role: "system" as const,
          content: DIRECTOR_SYSTEM,
          providerOptions: {
            anthropic: { cacheControl: { type: "ephemeral" as const } },
          },
        },
        {
          role: "user" as const,
          content: `Write a ${platform} caption for this clip.\n\nDraft: ${shotSpec.captionDraft}\nImage: ${shotSpec.imagePrompt}`,
        },
      ];
      onPayload?.({ model: modelIdOf(model), messages });

      const { object } = await generateObject({
        model,
        allowSystemInMessages: true,
        schema: z.object({ caption: z.string() }),
        messages,
      });
      return object.caption;
    },
  };
}
