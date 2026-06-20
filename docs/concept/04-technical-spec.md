# Technical spec

This document is the highest-signal input to `/sync-protocols`: the toolchain
table below is what populates the `AGENTS.md` Project Specifics. Treat provider
names as defaults for the phased-hybrid posture, not lock-in; every one sits
behind an adapter (see [02-architecture.md](02-architecture.md)).

## Language and runtime

- **Python 3.12+**, managed with **uv** (not pip or poetry).
- **ruff** for format and lint, **pytest** for tests.
- Type checking with **mypy** over `src/` (proposed default; swap for `ty` if
  preferred once it settles). The build should not pass with type errors.
- Package imports are absolute from the `studio` root; relative imports only
  within a single stage module.

## Project shape

- A **local web dashboard** (FastAPI) is the **primary operator surface**: gates A
  (concept), A.5 (base image), and B (clip), plus manual-inbox drops, all in one
  place. It lists runs awaiting action, plays the clip (portrait or landscape)
  inline with the safe zone overlaid, and offers approve / regenerate / revise.
- A **CLI** (Typer) triggers and advances runs (enough on its own for a headless
  run), but the human gates live in the dashboard, not split across the terminal
  and the Finder.
- Both share the same `core` run model and state store. No external services are
  required beyond the configured generation providers.

## Default providers (hybrid posture)

| Stage       | Default (auto)                                  | Manual / fallback               |
| ----------- | ----------------------------------------------- | ------------------------------- |
| Direct      | Claude (model configurable; abstracted)         | n/a                             |
| Image       | Flux.1 via fal or Replicate                     | `ManualInbox` (free web tier)   |
| Animate     | Runway or Kling via SDK / fal                   | `ManualInbox` (free web tier)   |
| Interpolate | `rife-ncnn-vulkan` (local, Metal)               | pass-through (no interpolation) |
| Export      | ProRes master + FCPXML, via `ffmpeg`            | n/a                             |
| Publish     | deferred to phase 2                             | manual upload                   |

The director defaults to Claude per the standing stack preference (the draft's
Gemini stays available as a swap, and is attractive for its free tier). The exact
Claude model id is pinned at implementation time, not here.

## Local tooling

- **`rife-ncnn-vulkan`**: the local interpolation engine. Installed from its
  release binary (or Homebrew if available) plus a RIFE model. Invoked as a
  subprocess; the interpolation factor maps to the draft's `-n 4`. If no usable GPU
  is present the stage passes through (no interpolation); `ffmpeg minterpolate` is
  not used. Topaz Video AI (paid, Apollo / Chronos models) is the cross-platform
  alternative behind the same stage interface.
- **`realesrgan-ncnn-vulkan`**: optional resolution upscaler for the local master,
  on the same Vulkan / Metal stack. Optional because platforms deliver 1080p.
- **`ffmpeg`**: Homebrew. Encodes the **ProRes 422 HQ** (or high-profile HEVC)
  **master**, the optional 1080p / 60 fps H.264 **delivery** encode per
  `OutputProfile`, applies the optional per-run LUT and watermark, and handles
  container and frame-rate housekeeping.
- **Editor-project export**: an **FCPXML** writer (imported by Premiere, Resolve,
  and Final Cut) for the B-roll handoff; a CapCut draft writer is a nice-to-have,
  since its format is reverse-engineered and brittle.

## Configuration and secrets

- **pydantic-settings** for typed config.
- **Style presets** as declarative files under `config/styles/` (for example
  `cinematic-fantasy.toml`, `cosmic-scifi.toml`): aesthetic description, prompt
  scaffolding, platform caption conventions. Adding a look is adding a file;
  content stays varied within and across presets.
- **Defaults** (selected providers, fps targets, paths, poll interval) and
  **output profiles** (orientation to delivery size, fps cap, and safe zone) in
  `config/settings.toml`.
- **Secrets** (provider API keys) in a gitignored `.env`, loaded at runtime, never
  committed and never placed under `config/`.

## Accounts and ownership

The repo, CI, and publishing identity sit under the **`earlgreylabs`** GitHub
account (Earl Grey Labs); the studio's platform channels (TikTok, Instagram,
YouTube) are Candelabrum Studio's. Use `gh` / `git` against `earlgreylabs` once the
remote is wired; platform API credentials live in `.env` like any other secret.

## Storage

- v1 uses the **filesystem**: per-run directory with `metadata.json` as both
  resume state and the learning record; `renders/{raw,interpolated}/` for working
  video; `ready/` for approved packages.
- A queryable index over the metadata records (SQLite) is a later-phase addition,
  not a v1 dependency.

## Notifications

- Gate B fires a **macOS notification** (via `osascript` or `terminal-notifier`)
  plus the dashboard entry. A Discord webhook is an optional later add for
  off-machine alerts.

## Toolchain (drives the AGENTS.md table)

| Action          | Command                                            |
| --------------- | -------------------------------------------------- |
| install         | `uv sync`                                           |
| format          | `uv run ruff format .`                              |
| lint            | `uv run ruff check .`                               |
| typecheck       | `uv run mypy src`                                   |
| test            | `uv run pytest`                                     |
| run (CLI)       | `uv run studio ...`                                 |
| run (dashboard) | `uv run studio dashboard`                           |
| build           | `uv build` (only if packaged; otherwise n/a)        |
| package manager | `uv`                                                |

## Validation gates (proposed)

In order, each must pass before a slice is done: `ruff format` (clean), `ruff
check`, `mypy`, `pytest`. Because much of the value is in live provider behaviour,
each slice is also exercised against reality (a real run, or a recorded fixture
for the provider calls) rather than verified from code alone.
