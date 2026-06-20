import { describe, expect, test } from "bun:test";
import { loadSettings, loadStyle, settingsSchema } from "@/core/config";

describe("config", () => {
  test("loads settings with both output profiles", async () => {
    const settings = await loadSettings("./config");
    expect(settings.profiles.portrait.deliveryWidth).toBe(1080);
    expect(settings.profiles.portrait.deliveryHeight).toBe(1920);
    expect(settings.profiles.portrait.safeZone.bottom).toBe(370);
    expect(settings.profiles.landscape.aspect).toBe("16:9");
    expect(settings.targets.masterFps).toBe(120);
    expect(settings.targets.pollIntervalSeconds).toBe(15);
  });

  test("loads the cosmic-scifi style preset", async () => {
    const style = await loadStyle("./config", "cosmic-scifi");
    expect(style.id).toBe("cosmic-scifi");
    expect(style.prompt.imageScaffold).toContain("{subject}");
    expect(style.caption.tiktok.length).toBeGreaterThan(0);
  });

  test("rejects malformed settings", () => {
    expect(() => settingsSchema.parse({ paths: {} })).toThrow();
  });

  test("reports a missing config file clearly", async () => {
    await expect(loadStyle("./config", "does-not-exist")).rejects.toThrow(/not found/);
  });
});
