# Candelabrum Studio

A local-first, single-operator digital-art engine for macOS / Apple Silicon. One
TypeScript app orchestrates a six-stage pipeline (direct → image → animate →
interpolate → caption → export) with three human gates (A concept, A.5 base
image, B clip).

- **What to build** lives in [`docs/concept/`](docs/concept/) (the source of intent).
- **The agent contract** is [`AGENTS.md`](AGENTS.md); **current build state** is
  [`BUILD_STATE.md`](BUILD_STATE.md).
- **Design tokens** are in [`DESIGN.md`](DESIGN.md).

## Requirements

- [Bun](https://bun.com) 1.3+ (runtime, package manager, test runner).
- Credentials for any automated providers you select. Manual image/video inboxes
  and the edited-caption passthrough remain available without provider keys.
- Optional native binaries, auto-detected via `Bun.which`: `rife-ncnn-vulkan`
  (frame interpolation) and `ffmpeg` (delivery encode). When either is absent the
  matching stage passes the clip through untouched, so the pipeline still reaches
  `ready`.

## Setup

```bash
brew install ffmpeg rife-ncnn-vulkan
bun install
cp .env.example .env     # then set ANTHROPIC_API_KEY in .env
```

`.env` is gitignored. Provider choices are made per operation in the dashboard
and persisted with the run.

## Configuration

The `config/` directory holds non-secret application defaults and aesthetic definitions:

- **`config/settings.toml`**: The main configuration file. It defines storage paths, output profiles (orientations, delivery sizes, fps caps, and safe-zone insets), and default providers for each pipeline stage. These providers only seed defaults; the operator can override them per-operation in the dashboard.
- **`config/styles/`**: This folder contains declarative style presets (e.g., `cosmic-scifi.toml`). Each file defines an aesthetic description, prompt scaffolding, and platform caption conventions. You can add a new look just by creating a new `.toml` file in this directory.

## Run (dashboard)

The dashboard is the product surface: it lists runs, streams stage progress over
SSE, shows an explanatory pipeline progress stepper, and presents the three human
gates as approve / reject / revise / regenerate actions. Every model-backed action
shows its capable providers, resolved model, availability, and estimated cost.

```bash
bun run dev            # Hono API on :3000, Vite dashboard on :5173 (proxies /api)
```

Open <http://localhost:5173>. Reaching Gate B fires a macOS notification.

## Run (headless CLI)

The CLI creates and advances the same runs from the terminal, including the same
per-operation provider authorization used by the dashboard.

```bash
bun run cli new        # create a run; the director proposes a concept, pauses at Gate A
                       #   --style <id>  (default: cosmic-scifi)
                       #   --orientation portrait|landscape  (default: portrait)
                       #   --lore "<campaign directive>" --concept-provider <id>
bun run cli list                 # all runs + status
bun run cli show <id>            # full run metadata (JSON)
bun run cli approve <id>         # pass a gate with its next-operation provider flag(s)
bun run cli revise <id> --instruction "<text>" [--provider <id>]
bun run cli regenerate <id> [--provider <id>]
bun run cli reject <id>          # discard a run                              (--note <text>)
bun run cli resume <id> [--provider <id>] # explicitly retry an interrupted paid stage
```

A run advances `directing → Gate A → imaging → Gate A.5 → upscaling → animating →
interpolating → Gate B → captioning → exporting → ready`. State is JSON on disk
under `runs/<id>/metadata.json`; the `status` is the single source of position
and drives resume. Uncertain paid submissions require an explicit retry after a
crash; local stages and persisted remote job polling resume automatically.

### Current state

v1 is feature-complete: all six pipeline stages are real and the full dashboard
is wired up. By stage:

- **direct** (1) — real, Claude via the Vercel AI SDK.
- **image** (2) / **animate** (3) — real, with capability-filtered automated and
  `ManualInbox` providers selectable at the matching operator action.
- **interpolate** (4) — wired to `rife-ncnn-vulkan`; the heavy frame
  extraction / re-encode is still stubbed, so it currently passes the raw clip
  through to the master.
- **caption** (5) — real, the director adapter drafts the platform caption.
- **export** (6) — real, `FfmpegExporter` writes the master, `caption.txt`, and
  `metadata.json` into the `ready/` package (encodes with `ffmpeg` when present,
  else copies the master through).

The remaining v1 milestone is a full end-to-end render against reality; see
[`BUILD_STATE.md`](BUILD_STATE.md). Auto-publishing (stage 7) is phase 2.

Generated output is gitignored: `runs/` (per-run state + artifacts),
`renders/{raw,master}/` (working video + masters), `ready/` (export packages).

## Develop

Validation gates, in order:

```bash
bun run biome format --write .   # format
bun run biome check .            # lint
bun run tsc --noEmit             # typecheck (strict)
bun test                         # tests
```
