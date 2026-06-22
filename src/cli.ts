#!/usr/bin/env bun
/** Headless access to the same run model, provider authorization, and gates as the dashboard. */

import { parseArgs } from "node:util";
import { loadSettings, loadStyle, type Settings, type Style } from "@/core/config";
import { ORIENTATIONS, type Orientation } from "@/core/constants";
import { advance, approve, regenerate, reject, revise } from "@/core/orchestrator";
import type { PipelineContext } from "@/core/pipeline";
import { type ProviderCapability, selectedProvider } from "@/core/provider-selection";
import { authorizeProvider, createRun, type Run } from "@/core/run";
import { RunStore } from "@/core/store";
import { providerOption } from "@/providers/catalog";
import { resolveDirector } from "@/providers/director";
import { resolveExporter } from "@/providers/export";
import { resolveImage } from "@/providers/image";
import { resolveVideo } from "@/providers/video";

const CONFIG_DIR = "./config";
const DEFAULT_STYLE = "cosmic-scifi";
const DEFAULT_ORIENTATION: Orientation = "portrait";

const USAGE = `Usage:
  bun run cli new [--style <id>] [--orientation portrait|landscape] [--lore <text>] [--concept-provider <id>]
  bun run cli list
  bun run cli show <id>
  bun run cli approve <id> [--note <text>] [--finalise-provider <id>] [--image-provider <id>] [--video-provider <id>] [--caption-provider <id>]
  bun run cli revise <id> --instruction <text> [--provider <id>]
  bun run cli regenerate <id> [--provider <id>]
  bun run cli reject <id> [--note <text>]
  bun run cli resume <id> [--provider <id>]`;

function parseOrientation(value: string | undefined): Orientation {
  if (value === undefined) return DEFAULT_ORIENTATION;
  if ((ORIENTATIONS as readonly string[]).includes(value)) return value as Orientation;
  throw new Error(`invalid orientation: ${value} (expected ${ORIENTATIONS.join(" | ")})`);
}

function directorCapabilityFor(run: Run): ProviderCapability {
  if (run.status === "directing") return "concept";
  if (run.status === "captioning" || run.status === "gate_b") return "caption";
  return "finalise";
}

function buildContext(
  settings: Settings,
  store: RunStore,
  run: Run,
  style?: Style,
  capability = directorCapabilityFor(run),
): PipelineContext {
  const directorId = selectedProvider(run.providerSelections, settings, capability);
  return {
    settings,
    store,
    director: resolveDirector(
      settings,
      directorId === "draft" ? settings.providers.director : directorId,
    ),
    image: resolveImage(settings, selectedProvider(run.providerSelections, settings, "image")),
    video: resolveVideo(settings, selectedProvider(run.providerSelections, settings, "video")),
    export: resolveExporter(),
    style,
    log: (message) => console.log(message),
    notify: (title, message) => console.log(`[Notify] ${title}: ${message}`),
  };
}

async function authorize(
  run: Run,
  store: RunStore,
  requests: Array<{ capability: ProviderCapability; provider?: string }>,
): Promise<void> {
  const validated = requests.map(({ capability, provider: requested }) => {
    const provider = requested ?? run.providerSelections[capability];
    if (!provider) throw new Error(`A ${capability} provider is required`);
    const option = providerOption(capability, provider);
    if (!option.available)
      throw new Error(option.unavailableReason ?? `${provider} is unavailable`);
    return { capability, provider };
  });
  for (const { capability, provider } of validated) authorizeProvider(run, capability, provider);
  await store.save(run);
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
      instruction: { type: "string" },
      provider: { type: "string" },
      "concept-provider": { type: "string" },
      "finalise-provider": { type: "string" },
      "image-provider": { type: "string" },
      "video-provider": { type: "string" },
      "caption-provider": { type: "string" },
    },
    allowPositionals: true,
  });

  const [command, id] = positionals;
  const settings = await loadSettings(CONFIG_DIR);
  const store = new RunStore(settings.paths.runs);

  if (command === "new") {
    const styleId = values.style ?? DEFAULT_STYLE;
    const run = createRun(settings, {
      orientation: parseOrientation(values.orientation),
      style: styleId,
      lore: values.lore,
    });
    await authorize(run, store, [{ capability: "concept", provider: values["concept-provider"] }]);
    await advance(run, buildContext(settings, store, run, await loadStyle(CONFIG_DIR, styleId)));
    console.log(`created run ${run.id}\n${summarise(run)}`);
    return;
  }

  if (command === "list") {
    const runs = await store.list();
    console.log(runs.length ? runs.map(summarise).join("\n\n") : "no runs yet");
    return;
  }
  if (command === "show") {
    if (!id) throw new Error("show requires a run id");
    console.log(JSON.stringify(await store.load(id), null, 2));
    return;
  }
  if (!id) {
    console.log(USAGE);
    if (command) process.exitCode = 1;
    return;
  }

  const run = await store.load(id);
  const style = await loadRunStyle(run);
  if (command === "approve") {
    let capability: ProviderCapability | undefined;
    if (run.status === "gate_a") {
      await authorize(run, store, [
        { capability: "finalise", provider: values["finalise-provider"] },
        { capability: "image", provider: values["image-provider"] },
      ]);
      capability = "finalise";
    } else if (run.status === "gate_a5") {
      await authorize(run, store, [{ capability: "video", provider: values["video-provider"] }]);
    } else if (run.status === "gate_b") {
      await authorize(run, store, [
        { capability: "caption", provider: values["caption-provider"] },
      ]);
      capability = "caption";
    }
    await approve(run, buildContext(settings, store, run, style, capability), values.note);
  } else if (command === "revise") {
    if (!values.instruction) throw new Error("revise requires --instruction");
    await authorize(run, store, [{ capability: "revision", provider: values.provider }]);
    await revise(run, buildContext(settings, store, run, style, "revision"), values.instruction);
  } else if (command === "regenerate") {
    const capability = run.status === "gate_a5" ? "image" : "video";
    await authorize(run, store, [{ capability, provider: values.provider }]);
    await regenerate(run, buildContext(settings, store, run, style));
  } else if (command === "reject") {
    await reject(run, buildContext(settings, store, run, style), values.note);
  } else if (command === "resume") {
    const capabilityByStatus: Partial<Record<Run["status"], ProviderCapability>> = {
      directing: "concept",
      imaging: "image",
      animating: "video",
      captioning: "caption",
    };
    const capability = capabilityByStatus[run.status];
    if (capability) await authorize(run, store, [{ capability, provider: values.provider }]);
    await advance(run, buildContext(settings, store, run, style, capability));
  } else {
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }
  console.log(summarise(run));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
