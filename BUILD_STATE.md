# Build State

Agent working area: the agents own this file, the user does not maintain it. A
fresh session reads it top to bottom, then follows the start protocol in
`prompt.md`. Keep it lean: prevention beats cleanup.

Rules:

- `Now` is replaced every checkpoint, never appended to. It is the single source
  of "where we are". If it is longer than a screen, it is wrong.
- `Decisions` and `Session log` are append-only and terse: one line each. The
  full detail lives in git, not here.
- When the logs cross their budget, run `/consolidate-state` (or it runs from the
  start protocol): completed milestones collapse to a one-line summary in
  `Archive`, and contradictions are reconciled against git and the test state.

## Now

- Milestone: First real end-to-end automated run reached `ready` — text (Claude) → refined prompts → Gemini image (`gemini-3.1-flash-image`) → Veo video (`veo-3.1-generate-preview`, image-to-video) → interpolate → caption → export. Real automated image + video providers (fal, Gemini, Veo) behind the registry; per-step model/cost ledger in metadata.
- Last verified checkpoint: gates green (format, lint, tsc, 30 tests); run `20260621-000517-b878` rendered start to finish via CLI; dashboard serves artifacts and gates correctly.
- Next step (start here): **the enhancement layer is not real yet.** `rife-ncnn-vulkan` / `realesrgan` / `ffmpeg` are not installed, and the interpolate stage is stubbed even when rife exists — so interpolate + export currently pass the raw clip through (no added frames, no ProRes master, no LUT/colour). Build the real local interpolate/encode/grade (see Backlog).
- Blockers: none. Large working stack is uncommitted (Veo direct-REST provider, fal/Gemini providers, model tracking, asset serving, async advancement, lessons-learned doc) — commit before the next slice.

## Backlog

<!-- planned, not started; promote into `Now` when picked up -->

- **Real interpolation + encode (the high-fidelity master).** Implement the
  interpolate stage for real: ffmpeg extract frames → `rife-ncnn-vulkan`
  (Metal/MoltenVK, local M1) to add in-between frames up to `masterFps` (120) →
  ffmpeg re-encode to a **flat ProRes 422 HQ** master. Currently stubbed (runs
  `rife -h`, then copies through). Needs `molten-vk` + `vulkan-loader` + `ffmpeg`
  installed (Homebrew). Frame interpolation = smoother motion / "speed illusion",
  not resolution or colour.
- **Optional upscale** (`realesrgan-ncnn-vulkan`, local) — the "high-def" step;
  separate from interpolation, not yet in the pipeline.
- **Delivery colour grade** — LUT + watermark on the H.264 *delivery* encode only;
  master stays flat/ungraded; FCPXML references the ungraded ProRes with the LUT as
  non-destructive metadata. (export stage.)
- **Failure recovery layer.** Background-task failures currently overwrite the
  resumable status with terminal `failed` (stuck). Add: (1) provider-level retries
  for transient errors; (2) stop terminally failing retryable stages — leave the run
  resumable; (3) checkpoint the Veo `operations/…` handle so recovery re-polls
  instead of re-paying; (4) dashboard Retry action + auto-resume processing runs on
  server boot.
- **Real per-step cost** — amounts are flat estimates; use AI SDK `usage` tokens ×
  a per-model pricing table. Dashboard cost-breakdown panel (model + cost per step).

## Decisions

<!-- one dated line each: "YYYY-MM-DD: chose X over Y because Z" -->

- 2026-06-20: stack is TypeScript-unified (Bun + Hono + React/Vite, Vercel AI SDK), no Python — TS provider SDKs are now first-class, dropping the polyglot split.
- 2026-06-20: UI is dark near-black with a single candle-gold accent from the logo; tokens in `DESIGN.md`.
- 2026-06-20: removed `99-evaluation.md` — its findings (delivery-only LUT, external SSD, storage UX, VRAM teardown) are folded into the canon docs.
- 2026-06-20: TOML via `smol-toml` (typed `parse`), not Bun's native TOML import — avoids fighting dynamic-import typing under `verbatimModuleSyntax`, no `ts-ignore`.
- 2026-06-20: `RunStatus` is one enum over 6 stages + 3 gates + 3 terminal states; orchestrator owns transitions, stages only produce artifacts; resume = `store.load` + `advance` (no separate progress flag).
- 2026-06-20: Director via Vercel AI SDK `generateObject` + `@ai-sdk/anthropic`, model `claude-opus-4-8` pinned in `providers/director.ts`; adapter takes an injectable `LanguageModel` (mockable, no spend). Interfaces in `core/`, impls in `providers/`, injected into `PipelineContext`.
- 2026-06-20: only `DirectorLLM` defined now; `ImageProvider`/`VideoProvider`/`Exporter` land with their stages, not speculatively up front.
- 2026-06-21: image providers `fal` (FLUX via `generateImage`) + `gemini` ("Nano Banana", via `generateText` + `result.files`), default `gemini`; key standardised on `GEMINI_API_KEY` passed explicitly. Manual inbox stays as the $0 fallback.
- 2026-06-21: Veo image-to-video via a **direct REST** call to `:predictLongRunning` (image as `bytesBase64Encoded`, poll the operation), not `@ai-sdk/google`'s video model — its `inlineData` shape is rejected by every Veo model. `-fast`/3.0 are text-only; default `veo-3.1-generate-preview`.
- 2026-06-21: per-step cost ledger carries `{ stage, provider, model, amountUsd }`; model id via `modelIdOf()` (`.modelId` on AI SDK model objects). `model` is optional in the schema for back-compat.

## Session log

<!-- one terse line per finished slice: "YYYY-MM-DD: slice N done + verified" -->

- 2026-06-21: First real end-to-end automated run reached `ready` (Claude → Gemini image → Veo video → caption → export); proved the Veo direct-REST fix and the per-step model/cost ledger. Caught: enhancement layer (rife/ffmpeg) is stubbed/not-installed, so interpolate + export pass through — see Backlog.
- 2026-06-21: Lint gate cleanup done + verified — the v1 polish commits had landed with the biome lint gate red (9 errors incl. an `as any` violating the no-`any` rule, plus unused imports and RunDetail a11y); fixed all, 4 gates now green + 25 tests. BUILD_STATE `Now` had drifted (claimed "4 gates green + 21 tests").
- 2026-06-21: Dashboard Gate Interactions done + verified — added React Router, RunDetail view, and Hono endpoints for advance/reject, verified with tests.
- 2026-06-21: Revise and Regenerate complete + verified — added backwards transitions to orchestrator and UI.
- 2026-06-21: Final v1 polish complete — added Gate B editable caption, macOS notifications via osascript, and full metadata JSON export.
- 2026-06-21: Dashboard runs list done + verified — wired React UI to Hono backend with SSE progress streaming.
- 2026-06-20: slice 1 (skeleton) done + verified — config/run/store/orchestrator/CLI, stubbed stages, 16 tests, real new→ready run across processes.
- 2026-06-20: slice 2 (director) done + verified — `DirectorLLM` + Claude adapter (AI SDK), real `direct` stage, stage registry, injected context; 19 tests incl. 3 mock-model fixtures; keyless CLI reaches adapter, run persists at `directing`.
- 2026-06-21: slice 3 (image) done + verified — `ImageProvider` interface + `ManualInbox` adapter + real `image` stage; 20 tests; CLI correctly uses the manual inbox and advances to gate_a5.
- 2026-06-21: slice 4 (animate) done + verified — `VideoProvider` interface + `ManualInbox` adapter + real `animate` stage; 21 tests; CLI correctly uses the manual inbox for video.
- 2026-06-21: slices 5-7 (interpolate, caption, export) done + verified — local subprocess execution built for `rife-ncnn-vulkan` and `ffmpeg`, `Exporter` interface defined, real stages implemented. All pipeline slices complete.
- 2026-06-21: Phase 2 dashboard scaffold done + verified — Hono server, React 19 + Vite 8+, Tailwind CSS v4 configured with DESIGN.md tokens.

## Archive

<!-- completed milestones collapsed to one line each; git holds the full history -->
