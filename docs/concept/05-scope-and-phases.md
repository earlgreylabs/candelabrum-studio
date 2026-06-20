# Scope and phases

The studio is built in phases so it is useful early and never blocked on the
gated, risky parts (platform publishing). This document defines the v1 boundary,
the slice plan that seeds `BUILD_STATE.md`, and what is deliberately deferred.

## v1 boundary

**In:** stages 1 through 6 of [01-pipeline.md](01-pipeline.md): direct, image,
animate, interpolate, caption, export, plus all three human gates (A, A.5, B) in
one local dashboard, and the per-run metadata record. The phased-hybrid posture
applies: each stage runs via API where one is configured, or via the `ManualInbox`
adapter where only a free web tier exists. Both orientations (portrait and
landscape) are supported from the start via the per-run `OutputProfile`, with
portrait the default.

**Out (v1):** all auto-publishing. v1 ends with an approved package in `ready/`
that the operator uploads by hand.

**Definition of done for v1:** the operator triggers a run, iterates with the
director to an approved concept (Gate A), approves the base image before any video
spend (Gate A.5), and a few minutes later is notified that the finished clip is
ready in the dashboard. They approve it (Gate B) and it lands in `ready/` as an
export package: the ProRes master, a generated caption, metadata, and an optional
editor project (FCPXML / CapCut draft) for the B-roll handoff. A new style or
concept can be added as config without engine changes.

## v1 slice plan

Sequential and each independently verifiable. These map onto `BUILD_STATE.md`
milestones.

1. **Skeleton.** Config loading (including output profiles), a default style
   preset (cosmic-scifi), the run model and on-disk state store, the CLI
   entrypoint, and resume-from-status. Verified by creating, persisting, and
   resuming a run with stubbed stages.
2. **Director loop + dashboard shell.** The DirectorLLM adapter (default Claude),
   concept variants, natural-language revision, an optional lore bible, and Gate A
   in a minimal dashboard, ending on an approved shot spec. Verified end to end with
   a stub image stage.
3. **Image stage + Gate A.5.** The ImageProvider interface with one API adapter and
   the `ManualInbox` adapter (drops handled in the dashboard); resolved seed
   recorded; the operator approves or re-rolls the base image at Gate A.5. Verified
   both auto and manual.
4. **Animate stage.** The async VideoProvider interface: submit, poll on
   `POLL_INTERVAL_SECONDS`, timeout, download to `renders/raw/`; plus the manual
   fallback. Verified against a recorded provider fixture and one live run.
5. **Interpolate stage.** The local `rife-ncnn-vulkan` subprocess to `MASTER_FPS`,
   producing the ProRes master; pass-through (no interpolation) when no GPU is
   present. Verified by interpolating a real raw clip on the Mac GPU and checking
   the master frame rate and codec.
6. **Gate B + export.** Gate B in the dashboard (inline portrait/landscape player
   with safe-zone overlay, editable caption, approve / reject / revise), the macOS
   notification, the caption stage, and the export package (ProRes master, caption,
   metadata, optional FCPXML editor project, optional direct 1080p/60 delivery
   encode) staged into `ready/`. Verified by a full operator run, in both
   orientations, from trigger to an approved package.
7. **Metadata record.** Ensure every stage writes its part of the learning record
   (seed, prompt variants, feedback, provider, cost). Verified by inspecting a
   completed run's `metadata.json`.

(The metadata record is woven through slices 1 to 6; slice 7 is the pass that
confirms it is complete and consistent.)

## Phase 2: publishing

Wire the deferred stage 7 once the platform approvals exist:

- Meta Graph API for Reels (Business/Creator account, app review for content
  publishing, the container-then-publish flow).
- TikTok Content Posting API (post to draft / `SELF_ONLY` first, then direct
  posting after audit).
- YouTube Shorts via the YouTube Data API (secondary reach channel; mind the
  monetization caveats in
  [06-economics-and-monetization.md](06-economics-and-monetization.md)).

**AI-content labelling is mandatory at publish:** every platform requires the
AI-generated label, and skipping it risks penalties up to loss of monetization.
Auto-publish remains behind the gate B approval and covers the post-as-is path;
clips routed through the B-roll editor handoff are posted from the editor, not by
the studio. See the gating realities in
[03-constraints-and-cost.md](03-constraints-and-cost.md) and the revenue strategy
in [06-economics-and-monetization.md](06-economics-and-monetization.md).

## Phase 3: leverage

Only once the core loop is proven and being used:

- A queryable index (SQLite) over the metadata records: which prompt structures
  produce the clips worth keeping, and which concepts and styles actually earn
  (brand clicks, shop sales), not just views. See
  [06-economics-and-monetization.md](06-economics-and-monetization.md).
- Scheduling: a cron trigger and multi-style rotation for an unattended daily run
  up to gate A.
- A webhook listener to replace polling for the async video stage.
- A richer dashboard (history, side-by-side variant review, cost and revenue).

## Explicit out of scope (all phases)

- Multi-user accounts or a hosted service: this is a single-operator local tool.
- In-app video editing or a timeline editor (cutting, compositing, keyframing,
  adding audio): Candelabrum exports an editor project instead and hands off to
  CapCut / Premiere / Resolve.
- Guaranteeing platform terms compliance: the operator owns the decision to post
  and the account risk it carries.
