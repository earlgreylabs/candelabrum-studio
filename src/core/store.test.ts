import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSettings, type Settings } from "@/core/config";
import { createRun } from "@/core/run";
import { RunStore } from "@/core/store";

describe("RunStore", () => {
  let dir: string;
  let settings: Settings;
  let store: RunStore;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "cs-store-"));
    settings = await loadSettings("./config");
    store = new RunStore(dir);
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test("save then load roundtrips the run", async () => {
    const run = createRun(settings, { orientation: "portrait" });
    await store.save(run);
    const loaded = await store.load(run.id);
    expect(loaded.id).toBe(run.id);
    expect(loaded.status).toBe("directing");
    expect(loaded.profile.deliveryHeight).toBe(1920);
  });

  test("list returns every saved run", async () => {
    const before = (await store.list()).length;
    await store.save(createRun(settings, { orientation: "portrait" }));
    await store.save(createRun(settings, { orientation: "landscape" }));
    expect((await store.list()).length).toBe(before + 2);
  });

  test("loading an unknown run throws", async () => {
    await expect(store.load("does-not-exist")).rejects.toThrow(/not found/);
  });
});
