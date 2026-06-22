import { describe, expect, test } from "bun:test";
import { MockLanguageModelV3 } from "ai/test";
import { createClaudeDirector } from "@/providers/llm/director-claude";

// A recorded model response: generateObject reads the JSON text content and
// validates it against the call's schema. No network, no spend.
function respondWith(object: unknown) {
  return async () => ({
    content: [{ type: "text" as const, text: JSON.stringify(object) }],
    finishReason: { unified: "stop" as const, raw: "stop" },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 1, text: 1, reasoning: 0 },
    },
    warnings: [],
  });
}

describe("ClaudeDirector adapter", () => {
  test("proposeConcepts parses the model's concepts", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: respondWith({
        concepts: [
          {
            rationale:
              "Weighed a few directions; a lone vessel reads cleanest under a forward push.",
            title: "Drift",
            summary: "a lone vessel",
            subject: "lone vessel",
          },
        ],
      }),
    });
    const director = createClaudeDirector(model);
    const concepts = await director.proposeConcepts({ count: 1 });
    expect(concepts).toHaveLength(1);
    expect(concepts[0]?.subject).toBe("lone vessel");
  });

  test("finalise builds a validated ShotSpec carrying the orientation and style", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: respondWith({
        imagePrompt: "A lone vessel adrift past a luminous nebula",
        motionPrompt: "slow forward camera push",
        captionDraft: "Drifting through the deep.",
      }),
    });
    const director = createClaudeDirector(model);
    const spec = await director.finalise(
      { title: "Drift", summary: "a lone vessel", subject: "lone vessel" },
      "portrait",
    );
    expect(spec.orientation).toBe("portrait");
    expect(spec.imagePrompt).toContain("nebula");
    expect(spec.style).toBe("none");
  });

  test("caption returns the model's caption string", async () => {
    const model = new MockLanguageModelV3({
      doGenerate: respondWith({ caption: "Into the deep. #scifi #spaceart" }),
    });
    const director = createClaudeDirector(model);
    const caption = await director.caption(
      {
        imagePrompt: "A lone vessel",
        motionPrompt: "push",
        captionDraft: "Into the deep.",
        style: "cosmic-scifi",
        orientation: "portrait",
      },
      "tiktok",
    );
    expect(caption).toContain("#scifi");
  });
});
