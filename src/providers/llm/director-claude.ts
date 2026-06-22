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
import type {
  DirectorLLM,
  PayloadObserver,
  Platform,
  ProposeConceptsInput,
} from "@/core/providers";
import { type Concept, conceptSchema, type ShotSpec, shotSpecSchema } from "@/core/run";
import { modelIdOf } from "@/providers/model-id";

const DIRECTOR_SYSTEM =
  "You are the creative director of a digital-art studio that produces short, " +
  "highly varied fantasy and sci-fi video clips. Propose a distinct, vivid concept " +
  "and write precise generation prompts. Favour forward camera travel and stable, " +
  "non-warping structure. Keep each new concept different from recent history.";

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
      onPayload?: PayloadObserver,
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
            "Propose one concept for a new short clip: the single strongest idea you can produce.",
            "Work like an art director. Use the rationale field to privately weigh several distinct directions (varying subject, setting, era, and mood) and note why your pick wins; then commit to that single strongest, most specific concept.",
            "Quality bar: a concrete subject, a vivid and particular setting, and a defined mood with intentional lighting. Avoid generic tropes and stock phrasing; aim for an unexpected yet coherent angle that reads clearly under a slow forward camera push with stable, non-warping structure.",
            styleBrief(style),
            lore ? `Campaign directive: ${lore}` : "",
            history?.length
              ? `Make it clearly distinct from recent concepts: ${history.join("; ")}`
              : "",
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ];
      onPayload?.({ model: modelIdOf(model), messages });

      const { object } = await generateObject({
        model,
        allowSystemInMessages: true,
        // Require the rationale so the model always reasons before committing to
        // the concept fields (chain-of-thought via field order).
        schema: z.object({ concepts: z.array(conceptSchema.required({ rationale: true })) }),
        messages,
      });
      return object.concepts.slice(0, count);
    },

    async revise(
      concept: Concept,
      instruction: string,
      onPayload?: PayloadObserver,
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
      onPayload?: PayloadObserver,
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
      onPayload?: PayloadObserver,
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
