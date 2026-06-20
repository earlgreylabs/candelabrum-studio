# Technology Stack: one TypeScript app, local media binaries

Candelabrum Studio deliberately avoids monolithic application frameworks, task
queues (Celery, BullMQ), and databases. It is an ultra-lightweight orchestration
layer that runs locally with a minimum footprint, leaving the M1 Max's CPU, GPU,
and unified memory free for video rendering.

The architecture is a **single TypeScript application**. An earlier draft split it
into a TS dashboard that spawned Python/Rust CLI scripts; that split is gone. Its
only justification was that the generation SDKs were Python-first, which is no
longer true (the Anthropic, fal, Replicate, and Runway clients are all first-class
TypeScript). A second runtime would add a toolchain, a dependency tree, and a
language boundary through the run state for no benefit. The app talks to the cloud
over HTTPS and shells out to exactly two native binaries (`rife-ncnn-vulkan`,
`ffmpeg`) for the GPU/CPU-bound media work.

## 1. Runtime and application: Bun + Hono + React

- **Runtime: Bun (1.3+).** Bun is the runtime, package manager, test runner, and
  bundler in one. It is TypeScript-native, has first-class `spawn`, built-in
  `.env` and TOML loading, and a built-in SQLite client for the later metadata
  index. This is the "bun when it's also the runtime" case. Node 24 LTS is a
  documented fallback if a dependency ever misbehaves on Bun.
- **Server: Hono (4.12+).** A ~14 KB web-standard framework that runs natively on
  Bun. It serves the built dashboard, exposes the run/state API, and streams
  stage progress and subprocess `stdout` to the UI over **Server-Sent Events**
  (SSE). It binds to `127.0.0.1` only.
- **Frontend: React 19 + Vite (8+) + Tailwind CSS v4 + shadcn/ui.** A single-page
  dashboard, built to static assets and served by Hono. Tailwind v4 + shadcn give
  a tokenised, restrained design system (see [07-ui-ux.md](07-ui-ux.md) and
  `DESIGN.md`); React carries the keyboard-driven batch review, the inline video
  player with safe-zone overlays, and the drag-and-drop manual inbox.
- **Director chat: Vercel AI SDK (`ai` v5+ with `@ai-sdk/anthropic`,
  `@ai-sdk/google`).** Its provider abstraction is the "swap Claude for Gemini in
  config, not code" requirement; streaming drives the Gate A chat.
- **Config & validation: Zod.** Typed parsing of the TOML config and the `.env`
  (the TypeScript counterpart to the original `pydantic-settings`).

## 2. The pipeline: in-process TypeScript stages

The heavy lifting (calling APIs, orchestrating interpolation and encode) runs as
discrete **in-process TypeScript stage modules**, one per pipeline stage, behind
the adapter interfaces in [02-architecture.md](02-architecture.md).

- Each stage does one thing: it reads its input from the run directory, produces
  its output, persists state, and returns. A stage is independently runnable from
  the **CLI** (`bun run cli stage animate --run <id>`), so a failure is trivially
  reproducible without the dashboard.
- The CLI and the server share the same `core`, so a headless run and a
  dashboard-driven run are the same code path.
- The only external processes are the media binaries below; everything else is a
  function call.

## 3. The media pipeline (local compute)

The tools that do the actual pixel-pushing on the local machine.

- **Frame interpolation: `rife-ncnn-vulkan`.** The load-bearing engine for the
  high-frame-rate "speed illusion." Its NCNN/Vulkan implementation runs on the
  Apple M1 Max GPU through **MoltenVK** (Vulkan-to-Metal). On Apple Silicon it
  needs `vulkan-loader` and `molten-vk` installed (Homebrew). Spawned as a
  subprocess and fully torn down before the encode.
- **Optional upscale: `realesrgan-ncnn-vulkan`.** Same Vulkan/Metal stack;
  optional because platforms deliver 1080p.
- **Media processing: `ffmpeg` (8.0+).** Wraps the RIFE frames into the **flat
  ProRes 422 HQ** master and produces the optional 1080p/60 H.264/AAC delivery
  encode, using **VideoToolbox** hardware acceleration where available. The
  optional LUT and watermark are applied to the **delivery encode only**; the
  master stays ungraded.
- **Editor handoff: an FCPXML writer (target DTD 1.13, Final Cut Pro 11+).** A
  small TypeScript module emits an FCPXML that references the ungraded ProRes
  master and the caption for one-click import into Final Cut, Premiere, or
  Resolve. A CapCut draft writer is a nice-to-have (its format is reverse-
  engineered and brittle).

## 4. System architecture diagram

```text
============================ LOCAL MACHINE (Apple M1 Max) ============================

 [ Web Browser ]
   React + Vite dashboard
        ^
        | (HTTP / SSE, localhost only)
        v
 [ Bun + Hono — one TypeScript app ]
   - core: run model · state (JSON on disk) · config (Zod/TOML)
   - Director chat (Vercel AI SDK) ----------------------> [ Cloud: Claude / Gemini ]
   - stage modules + provider adapters
   - subprocess controller (spawn + teardown)
        |  in-process stage calls          |  spawn (await exit)
        v                                   v
 [ Provider adapters (TS SDKs) ]       [ Local binaries ]
   - image  --> [ Cloud: FLUX.2 / fal ]    - rife-ncnn-vulkan (Metal/MoltenVK)
   - video  --> [ Cloud: Kling / Runway ]  - ffmpeg (VideoToolbox)
        |                                   |
        | (reads / writes)                  |
        v                                   v
 [ Storage — external Thunderbolt NVMe SSD (see 03 + 99) ]
   - runs/<id>/metadata.json
   - renders/{raw,master}/  (flat ProRes 422 HQ)
   - ready/                 (approved export packages)
```

## 5. Containerisation (mostly: don't, for v1)

Honest finding: **the pipeline is host-bound on macOS and should not run in a
container for v1.** Docker would defeat the local-GPU premise that makes the
project cheap.

- **Cannot be containerised on macOS.** `rife-ncnn-vulkan` needs the Apple GPU via
  Metal/MoltenVK; Docker Desktop on a Mac runs a Linux VM with no Metal or GPU
  passthrough, so there is no GPU inside the container. `ffmpeg` VideoToolbox
  acceleration is likewise host-only. And a containerised server cannot `spawn`
  the host's `ffmpeg`/`rife` binaries (it is isolated). Containerising the
  rendering half is a non-starter here.
- **Could be, but the split is not worth it.** The dashboard plus the cloud
  provider calls (image/video/LLM) are pure network + filesystem and would run in
  a container, but splitting them from the GPU stages on one Mac adds IPC for zero
  gain.
- **Where a container genuinely helps:**
  - **CI.** A Linux container running `bun install`, Biome, `tsc`, `bun test`, and
    `vite build`. The interpolation/encode stages are stubbed or skipped in CI (no
    GPU needed), so this is clean and reproducible.
  - **An optional dev container** for the pure-TypeScript parts (editor parity),
    explicitly excluding the media stages.
  - **A future Linux/cloud phase.** If the orchestrator ever runs on a Linux host
    with an NVIDIA GPU, `rife-ncnn-vulkan` (native Vulkan) plus `docker run
    --gpus all` would let the whole pipeline containerise. That contradicts the
    Apple Silicon local-first target, so it is explicitly a later, hypothetical
    phase, not v1.

Conclusion: ship v1 as a local Bun app; reserve Docker for CI and a possible
future Linux/GPU deployment.

## 6. Pinned versions (mid-2026 baseline)

Defaults at implementation time; every provider sits behind an adapter, and the
runtime libs follow their own release cadence. Exact patch versions are pinned in
the lockfile, not here.

| Component            | Baseline                | Notes                                            |
| -------------------- | ----------------------- | ------------------------------------------------ |
| Runtime              | **Bun 1.3+**            | runtime + package manager + test runner          |
| (fallback runtime)   | Node 24 LTS             | only if a dep misbehaves on Bun                  |
| Language             | TypeScript 5.x          | `strict` on; `tsc --noEmit` is a gate            |
| Server               | Hono 4.12+              | localhost SSE                                    |
| Frontend             | React 19 + Vite 8+      | SPA, built to static assets                       |
| Styling              | Tailwind CSS v4 + shadcn/ui | tokens in `DESIGN.md`                         |
| Director LLM         | Vercel AI SDK 5+        | `@ai-sdk/anthropic`, `@ai-sdk/google`            |
| Image client / model | `@fal-ai/client`; FLUX.2 [pro] | ~$0.03 / megapixel on fal                  |
| Video client / model | `@fal-ai/client`; Kling 2.5 Turbo Pro (or 3.0) | ~$0.35 / 5 s on fal             |
| Lint + format        | **Biome**               | one fast tool (the ruff of TS)                   |
| Tests                | `bun test` (or Vitest)  | provider calls via recorded fixtures             |
| Interpolation        | rife-ncnn-vulkan        | Metal via MoltenVK; needs molten-vk, vulkan-loader |
| Encode / container   | ffmpeg 8.0+             | VideoToolbox accel; flat ProRes master           |
| Editor handoff       | FCPXML DTD 1.13         | FCP 11+; references the ungraded master           |

## 7. Security and environment

- **No vendor lock-in:** every stage is behind an adapter interface, so providers
  (and the LLM) swap by config. The lock-in resistance is the adapter layer, not a
  choice of scripting language.
- **Secrets:** all API keys live in a local gitignored `.env`, loaded by Bun at
  runtime, never under `config/` and never committed.
- **Network:** the Hono server binds only to `127.0.0.1`, so the dashboard and the
  manual inbox are not reachable remotely without explicit tunnelling.
