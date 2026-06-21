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

- Milestone: Phase 2 scaffold complete. React + Vite + Tailwind v4 + Hono server wired up.
- Last verified checkpoint: Dashboard scaffold. 4 gates green + 21 tests. `bun run dev` spins up Hono on port 3000 and Vite on 5173, with API proxying.
- Next step (start here): Final polish for v1 completion. Add editable caption field in the RunDetail view for Gate B, trigger macOS notifications upon reaching Gate B, and perform a full end-to-end test of the Metadata record.
- Blockers: none.

## Decisions

<!-- one dated line each: "YYYY-MM-DD: chose X over Y because Z" -->

- 2026-06-20: stack is TypeScript-unified (Bun + Hono + React/Vite, Vercel AI SDK), no Python — TS provider SDKs are now first-class, dropping the polyglot split.
- 2026-06-20: UI is dark near-black with a single candle-gold accent from the logo; tokens in `DESIGN.md`.
- 2026-06-20: removed `99-evaluation.md` — its findings (delivery-only LUT, external SSD, storage UX, VRAM teardown) are folded into the canon docs.
- 2026-06-20: TOML via `smol-toml` (typed `parse`), not Bun's native TOML import — avoids fighting dynamic-import typing under `verbatimModuleSyntax`, no `ts-ignore`.
- 2026-06-20: `RunStatus` is one enum over 6 stages + 3 gates + 3 terminal states; orchestrator owns transitions, stages only produce artifacts; resume = `store.load` + `advance` (no separate progress flag).
- 2026-06-20: Director via Vercel AI SDK `generateObject` + `@ai-sdk/anthropic`, model `claude-opus-4-8` pinned in `providers/director.ts`; adapter takes an injectable `LanguageModel` (mockable, no spend). Interfaces in `core/`, impls in `providers/`, injected into `PipelineContext`.
- 2026-06-20: only `DirectorLLM` defined now; `ImageProvider`/`VideoProvider`/`Exporter` land with their stages, not speculatively up front.

## Session log

<!-- one terse line per finished slice: "YYYY-MM-DD: slice N done + verified" -->

- 2026-06-21: Dashboard Gate Interactions done + verified — added React Router, RunDetail view, and Hono endpoints for advance/reject, verified with tests.
- 2026-06-21: Revise and Regenerate complete + verified — added backwards transitions to orchestrator and UI.
- 2026-06-21: Dashboard runs list done + verified — wired React UI to Hono backend with SSE progress streaming.
- 2026-06-20: slice 1 (skeleton) done + verified — config/run/store/orchestrator/CLI, stubbed stages, 16 tests, real new→ready run across processes.
- 2026-06-20: slice 2 (director) done + verified — `DirectorLLM` + Claude adapter (AI SDK), real `direct` stage, stage registry, injected context; 19 tests incl. 3 mock-model fixtures; keyless CLI reaches adapter, run persists at `directing`.
- 2026-06-21: slice 3 (image) done + verified — `ImageProvider` interface + `ManualInbox` adapter + real `image` stage; 20 tests; CLI correctly uses the manual inbox and advances to gate_a5.
- 2026-06-21: slice 4 (animate) done + verified — `VideoProvider` interface + `ManualInbox` adapter + real `animate` stage; 21 tests; CLI correctly uses the manual inbox for video.
- 2026-06-21: slices 5-7 (interpolate, caption, export) done + verified — local subprocess execution built for `rife-ncnn-vulkan` and `ffmpeg`, `Exporter` interface defined, real stages implemented. All pipeline slices complete.
- 2026-06-21: Phase 2 dashboard scaffold done + verified — Hono server, React 19 + Vite 8+, Tailwind CSS v4 configured with DESIGN.md tokens.

## Archive

<!-- completed milestones collapsed to one line each; git holds the full history -->
