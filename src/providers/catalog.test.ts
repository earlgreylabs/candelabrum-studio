import { describe, expect, test } from "bun:test";
import { listProviderOptions, providerOption } from "@/providers/catalog";
import { FAL_VIDEO_MODELS } from "@/providers/video/fal";

describe("provider catalog", () => {
  test("filters providers by operation capability", () => {
    const options = listProviderOptions();
    expect(
      options.some((option) => option.id === "claude" && option.capability === "concept"),
    ).toBe(true);
    expect(options.some((option) => option.id === "manual" && option.capability === "image")).toBe(
      true,
    );
    expect(options.some((option) => option.id === "manual" && option.capability === "video")).toBe(
      true,
    );
    expect(options.some((option) => option.id === "draft" && option.capability === "caption")).toBe(
      true,
    );
  });

  test("rejects a provider used outside its capability", () => {
    expect(() => providerOption("video", "claude")).toThrow(/does not support video/);
  });

  test("offers each fal.ai animation model as a distinct video selection", () => {
    const falOptions = listProviderOptions().filter(
      (option) => option.capability === "video" && option.id.startsWith("fal-"),
    );

    expect(falOptions.map(({ id, model }) => ({ id, model }))).toEqual([
      { id: "fal-cosmos", model: FAL_VIDEO_MODELS.cosmos.endpoint },
      { id: "fal-seedance", model: FAL_VIDEO_MODELS.seedance.endpoint },
      { id: "fal-kling", model: FAL_VIDEO_MODELS.kling.endpoint },
    ]);
  });
});
