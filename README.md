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
- An `ANTHROPIC_API_KEY` for the director stage (the only stage wired to a real
  provider so far). Everything else runs without keys.

## Setup

```bash
bun install
cp .env.example .env     # then set ANTHROPIC_API_KEY in .env
```

`.env` is gitignored. Non-secret configuration (providers, paths, output
profiles, style presets) lives in [`config/`](config/).

## Run (headless CLI)

The CLI creates and advances runs. The human gates are exposed here as
`approve` / `reject` for headless use; in the product they live in the dashboard.

```bash
bun run cli new        # create a run; the director proposes a concept, pauses at Gate A
                       #   --style <id>  (default: cosmic-scifi)
                       #   --orientation portrait|landscape  (default: portrait)
                       #   --lore "<campaign directive>"
bun run cli list                 # all runs + status
bun run cli show <id>            # full run metadata (JSON)
bun run cli approve <id>         # pass the current gate, advance to the next
bun run cli reject <id>          # discard a run
bun run cli resume <id>          # continue from the run's persisted status
```

A run advances `directing → Gate A → imaging → Gate A.5 → animating →
interpolating → Gate B → captioning → exporting → ready`. State is JSON on disk
under `runs/<id>/metadata.json`; the `status` is the single source of position
and drives resume, so a crash continues rather than restarts.

### Current state

The **director (stage 1) is real** (Claude via the Vercel AI SDK). Stages 2-6
are **stubs** that write placeholder artifacts, so an approved run still reaches
`ready` end to end. The React/Vite dashboard and the real media stages
(image / video providers, `rife-ncnn-vulkan`, `ffmpeg`) are upcoming slices; see
[`BUILD_STATE.md`](BUILD_STATE.md).

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
