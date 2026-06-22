import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadSettings, type Settings } from "@/core/config";
import { createRun, transition } from "@/core/run";
import { FfmpegExporter } from "@/providers/export/ffmpeg-exporter";

describe("FfmpegExporter", () => {
  let root: string;
  let settings: Settings;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "cs-export-"));
    settings = await loadSettings("./config");
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("packages the master with its real extension and finalizes ready metadata", async () => {
    const master = join(root, "source.mov");
    await Bun.write(master, "prores master");
    const run = createRun(settings, { orientation: "portrait" });
    run.artifacts.masterClip = master;
    const exporter = new FfmpegExporter({
      which: () => null,
      run: async () => {},
    });

    const pkg = await exporter.package(run, join(root, "ready"));
    expect(pkg.video).toEndWith("master.mov");
    expect(await Bun.file(pkg.video).text()).toBe("prores master");
    expect(await Bun.file(join(pkg.dir, "metadata.json")).exists()).toBe(false);

    run.artifacts.exportPackage = pkg.dir;
    run.artifacts.exportVideo = pkg.video;
    transition(run, "ready", "test");
    await exporter.finalize(run, pkg.dir);

    const metadata = await Bun.file(join(pkg.dir, "metadata.json")).json();
    expect(metadata.status).toBe("ready");
    expect(metadata.artifacts.exportPackage).toBe(pkg.dir);
  });
});
