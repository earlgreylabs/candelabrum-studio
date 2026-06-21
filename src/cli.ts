#!/usr/bin/env bun
/**
 * Headless orchestrator entrypoint. Creates and advances runs; the human gates
 * (A / A.5 / B) are exposed here as `approve`/`reject` for headless use, but in
 * the product they live in the dashboard. See docs/concept/04-technical-spec.md.
 *
 *   bun run cli new [--style <id>] [--orientation portrait|landscape] [--lore <text>]
 *   bun run cli list
 *   bun run cli show <id>
 *   bun run cli approve <id> [--note <text>]
 *   bun run cli reject <id> [--note <text>]
 *   bun run cli resume <id>
 */

import { parseArgs } from "node:util";
import { loadSettings, loadStyle, type Settings, type Style } from "@/core/config";
import { ORIENTATIONS, type Orientation } from "@/core/constants";
import { advance, approve, reject } from "@/core/orchestrator";
import type { PipelineContext } from "@/core/pipeline";
import type { DirectorLLM, ImageProvider } from "@/core/providers";
import { createRun, type Run } from "@/core/run";
import { RunStore } from "@/core/store";
import { resolveDirector } from "@/providers/director";
import { resolveImage } from "@/providers/image";

const CONFIG_DIR = "./config";
const DEFAULT_STYLE = "cosmic-scifi";
const DEFAULT_ORIENTATION: Orientation = "portrait";

const USAGE = `Usage:
  bun run cli new [--style <id>] [--orientation portrait|landscape] [--lore <text>]
  bun run cli list
  bun run cli show <id>
  bun run cli approve <id> [--note <text>]
  bun run cli reject <id> [--note <text>]
  bun run cli resume <id>`;

function parseOrientation(value: string | undefined): Orientation {
  if (value === undefined) {
    return DEFAULT_ORIENTATION;
  }
  if ((ORIENTATIONS as readonly string[]).includes(value)) {
    return value as Orientation;
  }
  throw new Error(`invalid orientation: ${value} (expected ${ORIENTATIONS.join(" | ")})`);
}

function buildContext(
  settings: Settings,
  store: RunStore,
  director: DirectorLLM,
  image: ImageProvider,
  style?: Style,
): PipelineContext {
  return { settings, store, director, image, style, log: (message) => console.log(message) };
}

function summarise(run: Run): string {
  const total = run.cost.reduce((sum, entry) => sum + entry.amountUsd, 0);
  const artifacts = Object.entries(run.artifacts)
    .filter(([, value]) => value)
    .map(([key]) => key);
  return [
    `  ${run.id}`,
    `    status:      ${run.status}`,
    `    orientation: ${run.profile.orientation}`,
    `    style:       ${run.style ?? "(none)"}`,
    `    artifacts:   ${artifacts.length ? artifacts.join(", ") : "(none)"}`,
    `    cost:        $${total.toFixed(2)}`,
  ].join("\n");
}

async function loadRunStyle(run: Run): Promise<Style | undefined> {
  return run.style ? loadStyle(CONFIG_DIR, run.style) : undefined;
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: Bun.argv.slice(2),
    options: {
      style: { type: "string" },
      orientation: { type: "string" },
      lore: { type: "string" },
      note: { type: "string" },
    },
    allowPositionals: true,
  });

  const [command, id] = positionals;
  const settings = await loadSettings(CONFIG_DIR);
  const store = new RunStore(settings.paths.runs);
  const director = resolveDirector(settings);
  const image = resolveImage(settings);

  switch (command) {
    case "new": {
      const styleId = values.style ?? DEFAULT_STYLE;
      const orientation = parseOrientation(values.orientation);
      const style = await loadStyle(CONFIG_DIR, styleId);
      const ctx = buildContext(settings, store, director, image, style);
      const run = createRun(settings, { orientation, style: styleId, lore: values.lore });
      await store.save(run);
      await advance(run, ctx);
      console.log(`created run ${run.id}\n${summarise(run)}`);
      return;
    }
    case "list": {
      const runs = await store.list();
      if (runs.length === 0) {
        console.log("no runs yet");
        return;
      }
      console.log(runs.map(summarise).join("\n\n"));
      return;
    }
    case "show": {
      if (!id) {
        throw new Error("show requires a run id");
      }
      console.log(JSON.stringify(await store.load(id), null, 2));
      return;
    }
    case "approve": {
      if (!id) {
        throw new Error("approve requires a run id");
      }
      const run = await store.load(id);
      const ctx = buildContext(settings, store, director, image, await loadRunStyle(run));
      await approve(run, ctx, values.note);
      console.log(summarise(run));
      return;
    }
    case "reject": {
      if (!id) {
        throw new Error("reject requires a run id");
      }
      const run = await store.load(id);
      const ctx = buildContext(settings, store, director, image, await loadRunStyle(run));
      await reject(run, ctx, values.note);
      console.log(summarise(run));
      return;
    }
    case "resume": {
      if (!id) {
        throw new Error("resume requires a run id");
      }
      const run = await store.load(id);
      const ctx = buildContext(settings, store, director, image, await loadRunStyle(run));
      await advance(run, ctx);
      console.log(summarise(run));
      return;
    }
    default:
      console.log(USAGE);
      process.exitCode = command ? 1 : 0;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
