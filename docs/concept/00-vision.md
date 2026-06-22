# Vision: Candelabrum Studio

## What this is

Candelabrum Studio is a **human-directed digital-art engine**. The operator owns
the concept and the art direction; AI is the rendering tool. From one Mac, the
operator steers a pipeline that does the mechanical grind: a "creative director"
LLM proposes concepts, cloud APIs render a base image and animate it, the local
GPU interpolates it to a high frame rate, and the operator approves at a few quick
gates (concept, base image, finished clip). The output is high-fidelity short art
clips (portrait or landscape) plus captions.

The core use is to **post these clips as digital art** (faceless, with the human
as art director), monetised through an art brand, affiliate, and a funnel rather
than per-view ad funds (see
[06-economics-and-monetization.md](06-economics-and-monetization.md)). It also
supports an opt-in **B-roll handoff**: export the clips and captions as an editor
project (CapCut / FCPXML) to intercut with your own filmed footage when you want
the higher-monetisation, human-led route. What it never becomes is a second job:
the operator's work is light, high-value art direction, not production labour.

The engine is theme-agnostic and the content is deliberately varied: a catalogue
of high-definition, ultra-visual fantasy and sci-fi shorts. A figure walking a
city street wreathed in magic; a lone boat among gods on a cosmic sea; a spaceship
threading glowing nebulas; a rider on a stardust highway toward a supernova. No
single look defines it. Reusable **style presets** (an aesthetic plus prompt
scaffolding) live in config so a family of looks can be reused, but each run's
concept is its own. Adding a style or a concept is config, not an engine change.
Audience trust comes from **narrative**, not a fixed look: the director can run
serialised, sequential concepts from a campaign directive (a "lore bible"), so a
varied catalogue still tells an ongoing story.

## Who it is for

A single creator-operator (initially Daniel) running a personal content engine
from a Mac. Not a team tool, not a SaaS. The operator has taste and wants final
say, but does not want to do the busywork of prompting five separate tools,
downloading files, running an interpolator, and uploading twice. The studio
removes the drudgery and keeps the human on the only two decisions that matter:
"is this concept worth making?" and "is this clip worth posting?"

## The problem

Producing a steady stream of polished short-form video by hand is a tool-juggling
slog: ideate, prompt an image model, prompt a video model, wait on async renders,
interpolate frames in a separate app, review, caption, upload to two platforms
with different APIs. Each step is a context switch and a place to stall. The
leverage is in orchestration: one supervised pipeline instead of seven manual
apps.

## Studio identity and ownership

The studio is **Candelabrum Studio**, operated under **dnlbox**
(`dnlbox` on GitHub: the repo, publishing identity, and platform channels
live there). Its mark is at
[`docs/assets/candelabrum-studio.png`](../assets/candelabrum-studio.png): a
wrought-iron candelabrum lit against a swirling nebula, under an ornate wordmark.

That mark is the **studio's** outward identity (its channels, this repo, the
operator tool's chrome). It has **no connection to the look of the videos.** The
content sets its own aesthetic per piece and shares no fixed palette with the logo.
By default it carries no watermark or signature grade: each piece stands alone.
Both are optional, per-piece export options the operator can switch on (a watermark
on a commission, say), never an always-on studio stamp.
The operator tool (the review dashboard) is kept deliberately neutral and
functional precisely so clips of any aesthetic read clearly against it. Concrete
tokens are reconciled into `DESIGN.md` by `/sync-protocols`; see the design
direction in [02-architecture.md](02-architecture.md).

## Operating posture (phased hybrid)

The studio is built as an orchestrator with provider-agnostic adapters from day
one, but it does not assume a paid account, nor does it chase the impossible "$0
and fully automated" fantasy. It takes the cheapest viable path per stage:

- Where a free or cheap API exists, the orchestrator calls it directly.
- Where only a free web UI exists (no scriptable API, or scripting it breaks the
  service's terms), the operator performs that one step by hand and hands the
  artifact back to the pipeline. A manual step is just another adapter, so the
  orchestration code never branches on auto-versus-manual.
- Auto-publishing to platforms is a later phase, gated behind each platform's own
  app-review process.

So the studio is useful on day one at near-zero cost, and graduates toward fuller
automation as budget and platform approvals allow, without re-architecting. See
[03-constraints-and-cost.md](03-constraints-and-cost.md) for why "$0 and fully
automated" is a contradiction, and how the hybrid resolves it.

## What "done" looks like

- **v1:** the operator triggers a run, picks a concept from a few LLM-proposed
  variants (iterating in plain language), approves the base image, and a few
  minutes later is notified that the finished clip is ready in the dashboard. They
  approve it; it lands in `ready/` as an export package: the high-fidelity master,
  a generated caption, metadata, and (optionally) an editor project to intercut
  with their own footage. Posting is a manual step in v1.
- The studio keeps a per-clip metadata record (seed, every prompt variant, the
  operator's feedback, provider, and cost) so the prompt structures that produce
  good clips can be found and reused.
- A second content vertical can be added without touching the engine.

## Non-negotiables

- **Human-directed.** The operator approves the concept, the base image, and the
  finished clip. AI renders; the human directs. Nothing is marked ready (or, later,
  posted) without that direction.
- **Never a second job.** The operator's required work is light art direction in
  one dashboard. The tool absorbs the rendering grind; heavy paths (filming,
  editing) are always opt-in, never the default.
- **Provider-agnostic.** No single vendor is load-bearing. Swapping the image,
  video, publish, or LLM provider is config, not code.
- **Local-first heavy compute.** Frame interpolation runs on the operator's GPU,
  not in the cloud, to keep recurring cost near zero.
- **Runs on macOS / Apple Silicon.** The Windows-only tools in the source draft
  (Flowframes) are explicitly out; the Mac-native path is the spec.

## Explicit non-goals

- Not a multi-user product and not a hosted service.
- Not a general video editor: the operator does not cut, composite, or keyframe
  inside this tool.
- Not a guarantee of platform compliance: the studio assists, but the operator
  owns the decision to post and the account risk that carries.
