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

- Milestone: Slice 1 — Skeleton (config + run model + on-disk state + CLI + resume).
- Last verified checkpoint: none yet (greenfield; `docs/concept/` reconciled, protocols synced).
- Next step (start here): scaffold the Bun + TypeScript project (`package.json`,
  `tsconfig.json` with the `@/` path alias, Biome, `bun test`), then implement
  config loading (TOML + Zod, including `OutputProfile`s), the `cosmic-scifi` style
  preset, the `Run` model and on-disk JSON state store, the `bun run cli`
  entrypoint, and resume-from-`status`. Verify by creating, persisting, and
  resuming a run with stubbed stages.
- Blockers: none. (An external SSD is recommended before real renders; not needed
  for slice 1.)

## Decisions

<!-- one dated line each: "YYYY-MM-DD: chose X over Y because Z" -->

- 2026-06-20: stack is TypeScript-unified (Bun + Hono + React/Vite, Vercel AI SDK), no Python — TS provider SDKs are now first-class, dropping the polyglot split.
- 2026-06-20: UI is dark near-black with a single candle-gold accent from the logo; tokens in `DESIGN.md`.
- 2026-06-20: removed `99-evaluation.md` — its findings (delivery-only LUT, external SSD, storage UX, VRAM teardown) are folded into the canon docs.

## Session log

<!-- one terse line per finished slice: "YYYY-MM-DD: slice N done + verified" -->

## Archive

<!-- completed milestones collapsed to one line each; git holds the full history -->
