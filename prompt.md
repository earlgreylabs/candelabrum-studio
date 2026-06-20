# Session kickstart

Static, do not edit per session. There is no "goal" to insert here: what to build
lives in `docs/concept/` (the source of intent) and the current state lives in
`BUILD_STATE.md` (the agent working area).

## Start protocol

1. Read `AGENTS.md` (your contract), then inventory `.agents/` so project-local
   skills are available before any work begins.
2. Read `BUILD_STATE.md`. Reconcile `Now` against `git log --oneline -10` and the
   test state: if they disagree, fix `Now` before doing anything else. If the file
   is over budget (logs sprawling, contradictions present), run
   `/consolidate-state` first.
3. Exercise the last checkpoint (run the tests, a sample run, or boot the app) to
   confirm it is real.
4. Continue from `Now`'s "Next step". Record intent before the slice; verify and
   checkpoint after. Never end on a broken tree.

To (re)specialize the protocols after editing `docs/concept/`, run
`/sync-protocols`, then clear the session and start again from this file.
