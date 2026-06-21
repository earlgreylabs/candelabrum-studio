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
- An `ANTHROPIC_API_KEY` for the director — it powers both the concept (stage 1)
  and caption (stage 5) stages. No other key is needed by default.
- Optional native binaries, auto-detected via `Bun.which`: `rife-ncnn-vulkan`
  (frame interpolation) and `ffmpeg` (delivery encode). When either is absent the
  matching stage passes the clip through untouched, so the pipeline still reaches
  `ready`.

## Setup

```bash
bun install
cp .env.example .env     # then set ANTHROPIC_API_KEY in .env
```

`.env` is gitignored. Non-secret configuration (providers, paths, output
profiles, style presets) lives in [`config/`](config/).

## Run (dashboard)

The dashboard is the product surface: it lists runs, streams stage progress over
SSE, and presents the three human gates as approve / reject / revise / regenerate
actions (including a Gate B caption override before export).

```bash
bun run dev            # Hono API on :3000, Vite dashboard on :5173 (proxies /api)
```

Open <http://localhost:5173>. Reaching Gate B fires a macOS notification.

## Run (headless CLI)

The CLI creates and advances the same runs from the terminal; the gates are
exposed here as `approve` / `reject` for headless use.

```bash
bun run cli new        # create a run; the director proposes a concept, pauses at Gate A
                       #   --style <id>  (default: cosmic-scifi)
                       #   --orientation portrait|landscape  (default: portrait)
                       #   --lore "<campaign directive>"
bun run cli list                 # all runs + status
bun run cli show <id>            # full run metadata (JSON)
bun run cli approve <id>         # pass the current gate, advance to the next  (--note <text>)
bun run cli reject <id>          # discard a run                              (--note <text>)
bun run cli resume <id>          # continue from the run's persisted status
```

A run advances `directing → Gate A → imaging → Gate A.5 → animating →
interpolating → Gate B → captioning → exporting → ready`. State is JSON on disk
under `runs/<id>/metadata.json`; the `status` is the single source of position
and drives resume, so a crash continues rather than restarts.

### Current state

v1 is feature-complete: all six pipeline stages are real and the full dashboard
is wired up. By stage:

- **direct** (1) — real, Claude via the Vercel AI SDK.
- **image** (2) / **animate** (3) — real, defaulting to the `ManualInbox`
  adapter: the run pauses, prints an inbox path, and ingests the file you drop in.
  Swapping to a paid image/video API is a `config/settings.toml` change, not code.
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
