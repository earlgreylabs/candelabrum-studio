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

- Milestone: per-operation provider authorization, server modularization, and pipeline progress UX complete.
- Last verified checkpoint: format, Biome, strict TypeScript, 53 tests, and production build green. The running dashboard was exercised at New Run, Gate A, and Gate B without submitting a paid action.
- Provider result: capability-filtered concept, revision, finalise, image, video, caption, regenerate, and retry choices persist on the run before invocation. `settings.toml` supplies defaults only. Uncertain paid work never auto-resubmits after restart; local/manual work and persisted remote jobs can resume.
- Structure/UI result: Hono bootstrap, runtime, routes, and HTTP helpers are separated behind injectable dependencies with temporary-storage tests. Run Detail has a ten-step accessible progress tracker and explanatory provider/cost panels.
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
- 2026-06-22: per-operation provider authorization, safe paid-stage recovery, modular server, and pipeline progress UX complete and verified with 53 green tests plus live dashboard checks.

## Archive

<!-- completed milestones collapsed to one line each; git holds the full history -->

- 2026-06-20 to 2026-06-21: built the TypeScript pipeline, provider adapters, durable run state, CLI, dashboard gates, media stages, export, model/cost ledger, and first real automated run to `ready` (commits through `259a51a`).
