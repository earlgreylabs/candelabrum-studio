# Technical spec

This document is the highest-signal input to `/sync-protocols`: the toolchain
table below is what populates the `AGENTS.md` Project Specifics. Treat provider
names as defaults for the phased-hybrid posture, not lock-in; every one sits
behind an adapter (see [02-architecture.md](02-architecture.md)). The stack is
**TypeScript-unified** (the rationale is in [08-tech-stack.md](08-tech-stack.md)).

## Language and runtime

- **TypeScript 5.x** on **Bun 1.3+** (runtime, package manager, test runner). Node
  24 LTS is a documented fallback only if a dependency misbehaves on Bun.
- **Biome** for format and lint (one fast tool, the TS counterpart to ruff).
- **`tsc --noEmit`** for type checking, with `strict` on. The build does not pass
  with type errors.
- **`bun test`** (or Vitest) for tests.
- Imports are absolute from the `src` root via a `tsconfig.json` path alias
  (`@/...`); relative imports only within a single stage module.

## Project shape

- A **local web dashboard** (React + Vite served by a Hono server on Bun) is the
  **primary operator surface**: gates A (concept), A.5 (base image), and B (clip),
  plus manual-inbox drops, all in one place. It lists runs awaiting action, plays
  the clip (portrait or landscape) inline with the safe zone overlaid, shows a
  persistent storage gauge, and offers approve / regenerate / revise.
- A **CLI** (`bun run cli ...`) triggers and advances runs (enough on its own for
  a headless run) and can run any single stage in isolation, but the human gates
  live in the dashboard, not split across the terminal and the Finder.
- Both share the same `core` run model and state store. No external services are
  required beyond the configured generation providers.
- The Hono app is assembled from injectable runtime dependencies. Route modules
  handle HTTP validation and response mapping; orchestration remains in `core`.
  Server tests use temporary run roots and fake adapters, never the operator's
  live run directory.

## Default providers (hybrid posture)

| Stage       | Default (auto)                                       | Manual / fallback               |
| ----------- | ---------------------------------------------------- | ------------------------------- |
| Direct      | Claude via Vercel AI SDK (model configurable)        | n/a                             |
| Image       | FLUX.2 via `@fal-ai/client` (or Replicate)           | `ManualInbox` (free web tier)   |
| Animate     | Kling 2.5 Turbo Pro (or 3.0) / Runway via fal        | `ManualInbox` (free web tier)   |
| Interpolate | `rife-ncnn-vulkan` (local, Metal)                    | pass-through (no interpolation) |
| Export      | flat ProRes master + FCPXML, via `ffmpeg`            | n/a                             |
| Publish     | deferred to phase 2                                  | manual upload                   |

The director defaults to Claude per the standing stack preference, through the AI
SDK's provider abstraction (Gemini stays a config swap, attractive for its free
tier). The exact Claude model id is pinned at implementation time, not here.

## Local tooling

- **`rife-ncnn-vulkan`**: the local interpolation engine. Installed from its
  release binary (or Homebrew) plus a RIFE model, with `molten-vk` and
  `vulkan-loader` for the Metal path on Apple Silicon. Invoked as a subprocess and
  fully torn down before the encode. If no usable GPU is present the
  stage passes through (no interpolation); `ffmpeg minterpolate` is not used. Topaz
  Video AI (paid, Apollo / Chronos models) is the cross-platform alternative behind
  the same stage interface.
- **`realesrgan-ncnn-vulkan`**: optional resolution upscaler for the local master,
  on the same Vulkan / Metal stack. Optional because platforms deliver 1080p.
- **`ffmpeg` (8.0+)**: Homebrew. Encodes the **flat ProRes 422 HQ** (or high-
  profile HEVC) **master** and the optional 1080p / 60 fps H.264 **delivery**
  encode per `OutputProfile`, using VideoToolbox acceleration where available.
  The optional per-run LUT and watermark are applied to the **delivery encode
  only**; the master stays ungraded. It also handles container and
  frame-rate housekeeping.
- **Editor-project export**: an **FCPXML** writer (DTD 1.13, imported by Premiere,
  Resolve, and Final Cut 11+) that references the ungraded master and carries any
  LUT as non-destructive metadata; a CapCut draft writer is a nice-to-have, since
  its format is reverse-engineered and brittle.

## Configuration and secrets

- **Zod** for typed config and `.env` parsing (the TS counterpart to
  pydantic-settings).
- **Style presets** as declarative **TOML** files under `config/styles/` (for
  example `cinematic-fantasy.toml`, `cosmic-scifi.toml`): aesthetic description,
  prompt scaffolding, platform caption conventions. Adding a look is adding a file;
  content stays varied within and across presets.
- **Defaults** (selected providers, fps targets, paths, poll interval) and
  **output profiles** (orientation to delivery size, fps cap, and safe zone) in
  `config/settings.toml`. `renders/` and `ready/` default to the external SSD (see
  [03-constraints-and-cost.md](03-constraints-and-cost.md)).
- **Per-operation provider selections** in each run's metadata. The dashboard
  filters adapters by capability and persists the choice before the matching
  model call. Defaults seed a choice but never prevent a different selection for
  the next operation.
- **Secrets** (provider API keys) in a gitignored `.env`, loaded at runtime, never
  committed and never placed under `config/`.

## Accounts and ownership

The repo, CI, and publishing identity sit under the **`dnlbox`** GitHub
account (dnlbox); the studio's platform channels (TikTok, Instagram,
YouTube) are Candelabrum Studio's. Use `gh` / `git` against `dnlbox` once the
remote is wired; platform API credentials live in `.env` like any other secret.

## Storage

- v1 uses the **filesystem**: per-run directory with `metadata.json` as both
  resume state and the learning record; `renders/{raw,master}/` for working video
  and the flat ProRes masters; `ready/` for approved packages. These default to
  the external SSD; on a single Mac the internal disk fills in roughly 40 to 50
  runs (see [03-constraints-and-cost.md](03-constraints-and-cost.md)).
- A queryable index over the metadata records (Bun's built-in SQLite) is a
  later-phase addition, not a v1 dependency.

## Notifications

- Gate B fires a **macOS notification** (via `osascript` or `terminal-notifier`)
  plus the dashboard entry. A Discord webhook is an optional later add for
  off-machine alerts.

## Toolchain (drives the AGENTS.md table)

| Action          | Command                                            |
| --------------- | -------------------------------------------------- |
| install         | `bun install`                                       |
| format          | `bun run biome format --write .`                    |
| lint            | `bun run biome check .`                              |
| typecheck       | `bun run tsc --noEmit`                               |
| test            | `bun test`                                           |
| run (CLI)       | `bun run cli ...`                                    |
| run (dashboard) | `bun run dev`                                        |
| build           | `bun run build` (Vite frontend + server bundle)     |
| package manager | `bun`                                               |

## Validation gates (proposed)

In order, each must pass before a slice is done: Biome format (clean), Biome
check (lint), `tsc --noEmit` (types), `bun test`. Because much of the value is in
live provider behaviour, each slice is also exercised against reality (a real run,
or a recorded fixture for the provider calls) rather than verified from code alone.
