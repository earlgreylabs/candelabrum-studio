# AGENTS.md

The canonical, harness-agnostic contract for any AI coding agent in this repo
(Claude Code, Codex, Gemini / Antigravity, Cursor, opencode, and others). Read
this first, every session. It is intentionally lean so the harness can cache it;
volatile state and project detail live in the files it points to.

This file has two layers, and the split is the whole point:

- Operational canonical (everything above the Project Specifics marker): the
  universal, stack-agnostic guardrails for AI-assisted work, the Don'ts, the
  workflow, delegation, and continuity. The same in every project. Do not
  hand-edit it.
- Project Specifics (below the marker): how those universals are realised for
  this stack, the toolchain, validation gates, and stack rules. Reconciled from
  `docs/concept/` by `/sync-protocols`, and hand-editable.

The baseline states intent; Project Specifics states the concrete how. If a
project looks nothing like a web app (an ML pipeline, a game, a batch system, a
native binary), nothing in the baseline changes: only Project Specifics does.

## Agnostic tooling convention

- Persistent agent instructions live in `AGENTS.md` (this file). Any
  harness-specific file only points here.
- Subdirectories may carry their own `AGENTS.md`; the deepest one wins for that
  path (useful in monorepos and multi-package trees).
- Skills, hooks, rules, and settings live under `.agents/`. The engine ships
  three canonical skills:
  - `find-skills`: discover and install new capabilities (`npx skills`).
  - `sync-protocols`: reconcile this file and `DESIGN.md` against `docs/concept/`.
  - `consolidate-state`: keep `BUILD_STATE.md` lean and self-consistent.
- Skills the project depends on are vendored under `.agents/skills/` and committed
  (tracked in `skills-lock.json`), so every harness and a fresh clone get the same
  set. Do not rely on a skill installed only at the harness or user level; if one
  is useful, vendor it into the project with `find-skills`.

## Source of truth

- `docs/concept/` is the source: the human-authored intent for what gets built.
  It may be unstructured, so read all of it. Infer the stack and goals from it;
  do not expect a fixed file layout.
- The `AGENTS.md` and `DESIGN.md` Project Specifics sections are derived from
  `docs/concept/` via `/sync-protocols`. Users also hand-edit them, so never
  clobber human content: merge.
- `BUILD_STATE.md` is the agent working area (state, progress, handoff). Agents
  own it; the user does not maintain it.
- `prompt.md` is the static session kickstart. It does not change per session.

## Operational constraints (do not)

- Never modify generated or build output: compiled artifacts, generated types, or
  lockfiles (unless the task itself is the dependency change).
- Never suppress the checks the project relies on: do not silence the type system
  or errors with unsafe casts or blanket ignore directives (for example TS
  `any` / `@ts-ignore`). Validate at boundaries and handle the error.
- Never commit secrets, tokens, or local env values.
- Never leave debug artifacts (stray prints or logs). Use the project's logger.
- Never expand scope. Every changed line traces to the task; do not refactor
  unrelated code, and match existing style.
- Never run a command that is not declared in Project Specifics. Ask, or add it
  via `/sync-protocols`. Do not guess.
- Get approval before destructive or outward-facing actions: commits, database
  writes, and any external comms (GitHub, Slack, issues).

## Validation workflow

Before finalizing any slice, run the project's declared validation gates (in
Project Specifics), in order, and ensure each passes. What the gates are is a
project concern, not a fixed list: a typed web stack might use format, lint,
typecheck, test, build; an ML pipeline an eval-metric threshold; a batch system a
clean compile plus an output diff; a native binary a sanitizer run.

Every slice ends verified by exercising the change against reality (the running
app, a pipeline run, a job's output, a binary run, the test suite), not by
assuming from code. If no gates are declared, ask or run `/sync-protocols` before
claiming validation.

## Delegation & model routing

Tokens are the scarcest resource, main-loop context most of all. The main agent
is the architect and integrator, not the typist. Route work by capability tier;
each harness maps a tier to one of its own models.

- deep (main loop): architecture, security / auth / tenancy, integration,
  debugging, all commits and `BUILD_STATE.md` edits, every decision.
- standard (subagent): well-specified implementation against a clear contract, a
  component to a prop spec, a migration, a route handler, a test suite.
- fast (subagent): mechanical or bulk work, renames, fixtures, seed data, string
  extraction, pattern refactors.
- explore (read-only subagent): "where is X / how does Y work" questions. Do not
  burn main context reading what a subagent can summarize.

Safety: parallelise within a slice, never across (slices stay sequential and
verified); one writer per file area (worktree isolation if unavoidable);
subagent output is untrusted until verified in the main loop; never delegate
decisions, protocol or `BUILD_STATE.md` edits, or final integration. Long
installs and builds run in the background.

## Session continuity protocol

Engineer for sudden death: a window can end abruptly.

1. On start: read this file, inventory `.agents/`, read `BUILD_STATE.md`, check
   `git log --oneline -10`, and exercise the last checkpoint (tests, a sample run,
   or booting the app) to confirm it is real. Resuming is not a special mode; this
   is the procedure.
2. Before a slice: record intent in `BUILD_STATE.md` (what, why, how verified).
3. After a slice: verify, replace `Now` in `BUILD_STATE.md`, add one terse line
   to its Session log, and commit. The tree is never more than about an hour from
   a clean, green commit.
4. Never end on a broken tree. If tokens run low: stop adding behaviour, get to
   green, checkpoint, write the next session's first step into `BUILD_STATE.md`.
5. New decisions mid-build: take the smallest reversible default, log it in
   `BUILD_STATE.md`, flag it for the user. Do not silently expand scope.

<!-- BEGIN PROJECT SPECIFICS: reconciled from docs/concept/ by /sync-protocols,
and hand-editable. Everything above is generic baseline; do not hand-edit it. -->

## Project Specifics

> Empty in a fresh scaffold. Put your intent in `docs/concept/`, then run
> `/sync-protocols`. Shape these to the stack: a web app, an ML pipeline, a game,
> a batch system, and a monorepo do not look alike here.

### Descriptor

[Run `/sync-protocols` to populate this based on your `docs/concept/`]

### Toolchain

| Action          | Command |
| --------------- | ------- |
| install         |         |
| format          |         |
| lint            |         |
| typecheck       |         |
| test            |         |
| run / dev       |         |
| build           |         |
| package manager |         |

### Validation gates

[Run `/sync-protocols` to populate this based on your `docs/concept/`]

### Stack-specific rules

[Run `/sync-protocols` to populate this based on your `docs/concept/`]

<!-- END PROJECT SPECIFICS -->
