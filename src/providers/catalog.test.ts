import { describe, expect, test } from "bun:test";
import { listProviderOptions, providerOption } from "@/providers/catalog";

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
});
