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

- Milestone: local media path relocation fix complete, pending commit approval.
- Last verified checkpoint: format, Biome, strict TypeScript, 61 tests, and real route smoke for run `20260622-152902-74dd` asset kinds `image`, `rawClip`, `masterClip`, and `exportVideo` all passed.
- Result: dashboard asset serving now falls back from stale absolute artifact paths to the current configured `runs`, `renders`, and `ready` roots when the recorded path no longer exists.
- Next step: restart the dashboard if it is already running, then continue export contract work.
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
- 2026-06-22: expose fal video models as distinct provider selections so the persisted authorization identifies the exact endpoint used for paid generation.

## Session log

<!-- one terse line per finished slice: "YYYY-MM-DD: slice N done + verified" -->

- 2026-07-01: moved-repo local asset fallback complete and verified with 61 green tests plus real route smoke for `20260622-152902-74dd`.
- 2026-06-21: resilience hardening complete and verified - atomic state saves, deduplicated execution/mutations, resumable errors, idempotent stages, explicit media degradation, final export metadata, and 39 green tests.
- 2026-06-22: per-operation provider authorization, safe paid-stage recovery, modular server, and pipeline progress UX complete and verified with 53 green tests plus live dashboard checks.
- 2026-06-22: fal.ai Cosmos, Seedance, and Kling Turbo animation options complete and fixture-verified with 58 green tests plus production build.
- 2026-06-22: failed Veo-to-Kling resume routing fixed and real run `20260621-172136-d217` advanced to interpolation; 60 tests and build green.

## Archive

<!-- completed milestones collapsed to one line each; git holds the full history -->

- 2026-06-20 to 2026-06-21: built the TypeScript pipeline, provider adapters, durable run state, CLI, dashboard gates, media stages, export, model/cost ledger, and first real automated run to `ready` (commits through `259a51a`).
