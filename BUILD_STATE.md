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

- Milestone: Slice 1 — Skeleton: DONE + verified. Next: Slice 2 — adapter
  interfaces + the first real stage (Director).
- Last verified checkpoint: Slice 1 skeleton. All 5 gates green (format, lint,
  `tsc`, `bun test` = 16 pass), plus a real CLI run driven new→ready across
  separate processes (cross-process resume) + a reject. Artifacts land on disk
  (`runs/<id>/`, `renders/{raw,master}/`, `ready/<id>/`); `status` drives resume.
- Next step (start here): define the adapter interfaces in `core`
  (`DirectorLLM`, `ImageProvider`, `VideoProvider`, `Exporter`) and a provider
  registry keyed by the `settings.providers.*` names; implement the **Director**
  stage for real via the Vercel AI SDK (Claude default, model pinned at impl) so
  Gate A produces a real `ShotSpec`, and a `ManualInbox` image adapter. Keep the
  other stages stubbed. Verify with a recorded provider fixture (no live spend in
  the gate) plus the existing CLI flow.
- Blockers: none. (External SSD recommended before real renders; not needed yet.)

## Decisions

<!-- one dated line each: "YYYY-MM-DD: chose X over Y because Z" -->

- 2026-06-20: stack is TypeScript-unified (Bun + Hono + React/Vite, Vercel AI SDK), no Python — TS provider SDKs are now first-class, dropping the polyglot split.
- 2026-06-20: UI is dark near-black with a single candle-gold accent from the logo; tokens in `DESIGN.md`.
- 2026-06-20: removed `99-evaluation.md` — its findings (delivery-only LUT, external SSD, storage UX, VRAM teardown) are folded into the canon docs.
- 2026-06-20: TOML via `smol-toml` (typed `parse`), not Bun's native TOML import — avoids fighting dynamic-import typing under `verbatimModuleSyntax`, no `ts-ignore`.
- 2026-06-20: `RunStatus` is one enum over 6 stages + 3 gates + 3 terminal states; orchestrator owns transitions, stages only produce artifacts; resume = `store.load` + `advance` (no separate progress flag).

## Session log

<!-- one terse line per finished slice: "YYYY-MM-DD: slice N done + verified" -->

- 2026-06-20: slice 1 (skeleton) done + verified — config/run/store/orchestrator/CLI, stubbed stages, 16 tests, real new→ready run across processes.

## Archive

<!-- completed milestones collapsed to one line each; git holds the full history -->
