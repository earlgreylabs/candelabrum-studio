---
name: sync-protocols
description: Reconcile the protocol files (AGENTS.md and DESIGN.md) against docs/concept/. Use when the user has added or changed anything in docs/concept/, says "sync protocols", "update the protocols", "specialize the scaffold", or after a stack or scope decision that should be reflected in the agent's contract.
---

# Sync Protocols

This skill keeps the derived protocol files specialized to the project. The source
of truth is `docs/concept/`; the derived files are the Project Specifics regions
of `AGENTS.md` and `DESIGN.md`. This skill is the compiler between them.

The baseline (everything above the Project Specifics marker) is universal and is
never touched. All stack shape lives in Project Specifics: that is where a Unity
game, an ML pipeline, a COBOL batch system, or a Rust binary each get the toolchain
and gates that actually fit them.

## What it owns

It only edits content inside the Project Specifics markers:

- `AGENTS.md`: between `<!-- BEGIN PROJECT SPECIFICS -->` and
  `<!-- END PROJECT SPECIFICS -->` (Descriptor, Toolchain, Validation gates,
  Stack-specific rules).
- `DESIGN.md`: the token frontmatter and the Project Specifics region.

It never touches the generic baseline. It may seed `BUILD_STATE.md`'s `Now` once,
when it is empty (bootstrap), but never edits a populated one: that is the agent
working area (see `consolidate-state`).

## Procedure

1. Read every file in `docs/concept/`. Do not assume a fixed layout or filenames;
   infer the stack, goals, brand, and constraints from whatever is there.
2. Read the current Project Specifics regions of `AGENTS.md` and `DESIGN.md`.
3. Derive the updated regions. Match the shape to the stack, do not assume web:
   - Descriptor: what the project is, its phase, what is locked.
   - Toolchain: the actions that matter for this stack, not a fixed web set. A
     Unity game has engine build and play-mode tests; an ML pipeline has data-prep
     / train / evaluate; a COBOL batch has compile / submit / diff; a monorepo or
     multi-platform project may need one table per package or target. If a command
     cannot be determined, leave it blank and flag it rather than guessing.
   - Validation gates: the ordered checks a slice must pass (commands, or
     descriptions where a gate is not a single command, like an eval-metric
     threshold or an output diff against a baseline).
   - Stack-specific rules: conventions unique to this stack.
   - `DESIGN.md` tokens and rationale, if the project has a UI (reshape for the
     medium; a game art bible or a mobile HIG is not web CSS tokens).
4. Merge, do not clobber. The Project Specifics regions are co-owned: preserve any
   hand-written content the user added. Reconcile only what the concept docs imply;
   keep human additions unless they directly contradict the source.
5. Recommend skills for the stack: from the concept, suggest what `find-skills`
   should look for (a Unity game wants game/engine skills, an ML project wants
   data/eval skills), and with approval vendor the relevant ones into
   `.agents/skills/` so they are consistent across harnesses. Note where the
   ecosystem is thin for this stack rather than installing low-quality matches.
6. Bootstrap state, once: if `BUILD_STATE.md`'s `Now` is still empty (a fresh
   scaffold), seed it with a first milestone and next step drawn from the concept.
   Never edit a `Now` that already has content.
7. Present the changes as a diff and get approval before writing. Never silently
   rewrite.

## Rules

- Edit only inside the Project Specifics markers (plus a one-time seed of an empty
  `BUILD_STATE.md` `Now`).
- Never invent a toolchain command. Blank-and-flag beats a wrong guess.
- Surface contradictions between concept docs rather than silently resolving them.
- After applying, suggest the user clear the session and resume from `prompt.md`.
