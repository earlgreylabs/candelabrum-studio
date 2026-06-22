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

- Milestone: pipeline resilience hardening complete. Runs now deduplicate execution and operator mutations, persist retryable errors at the current stage, auto-resume interrupted work on server boot, and reuse completed artifacts on retry.
- Last verified checkpoint: format, Biome, `tsc`, 39 tests, and build green. Recorded fixtures cover duplicate starts, mutation serialization, resumable provider failure, Veo poll retry, installed-tool failure, explicit pass-through, and export-finalization retry. Dashboard restarted and verified `API: connected` with existing run history.
- Media/export result: missing local tools create a labelled pass-through master; installed-tool failures pause visibly. Export always packages the real master extension and writes metadata only after `ready`.
- Next step: complete the remaining export contract: per-run optional LUT/watermark, profile-aware delivery encode, and FCPXML handoff. Then reconcile the working Topaz stage with the optional upscale adapter decision.
- Blockers: none.

## Backlog

<!-- planned, not started; promote into `Now` when picked up -->

- **Export contract completion.** Optional per-run LUT/watermark, flat master in
  the package, FCPXML handoff, and profile-aware delivery encode.
- **Optional upscale alignment.** Reconcile the working Topaz stage with the
  provider-agnostic optional upscale decision before expanding it.
- **Real per-step cost** — amounts are flat estimates; use AI SDK `usage` tokens ×
  a per-model pricing table. Dashboard cost-breakdown panel (model + cost per step).

## Decisions

<!-- one dated line each: "YYYY-MM-DD: chose X over Y because Z" -->

- 2026-06-21: a retryable stage failure keeps its current `status`; structured error metadata explains the pause, and retry resumes from that same status. `failed` remains for legacy/unrecoverable runs only.
- 2026-06-21: one in-process execution per run; repeated HTTP actions join or reject the active execution instead of starting duplicate provider work.
- 2026-06-21: missing local enhancement tools may degrade explicitly, but an installed tool failing is an actionable stage failure, never silent success.

## Session log

<!-- one terse line per finished slice: "YYYY-MM-DD: slice N done + verified" -->

- 2026-06-21: resilience hardening complete and verified - atomic state saves, deduplicated execution/mutations, resumable errors, idempotent stages, explicit media degradation, final export metadata, and 39 green tests.

## Archive

<!-- completed milestones collapsed to one line each; git holds the full history -->

- 2026-06-20 to 2026-06-21: built the TypeScript pipeline, provider adapters, durable run state, CLI, dashboard gates, media stages, export, model/cost ledger, and first real automated run to `ready` (commits through `259a51a`).
