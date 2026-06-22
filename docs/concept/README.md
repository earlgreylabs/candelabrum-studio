# docs/concept: Candelabrum Studio

This folder is the human-authored source of truth for *what gets built*: a
local-first, human-directed digital-art studio that turns a daily idea into
high-fidelity short art clips (portrait or landscape) for Reels, TikTok, and
YouTube Shorts. The agent reads all of it and infers the stack, goals,
and constraints; `/sync-protocols` then reconciles that intent into the Project
Specifics regions of `AGENTS.md` and `DESIGN.md`.

After editing anything here, run `/sync-protocols`, then clear the session and
resume from `prompt.md`.

## Doc map (read in order)

- [00-vision.md](00-vision.md): the north star, what the studio is, who it is
  for, the phased-hybrid posture, and what "done" looks like.
- [01-pipeline.md](01-pipeline.md): the pipeline stages and the human gates,
  with each stage's input, output, and automation.
- [02-architecture.md](02-architecture.md): the one-TypeScript-app shape,
  provider-agnostic adapters, the run and state model, async video handling, the
  colour-grading and subprocess rules, the review surface, and the directory layout.
- [03-constraints-and-cost.md](03-constraints-and-cost.md): the macOS reality, why
  "$0 and fully automated" is a contradiction, app-review-gated publishing, terms
  and account risk, output constants, and the cost model.
- [04-technical-spec.md](04-technical-spec.md): stack, default providers, local
  tooling, config and secrets, and the toolchain table that drives `AGENTS.md`.
- [05-scope-and-phases.md](05-scope-and-phases.md): the v1 boundary, the slice
  plan that seeds `BUILD_STATE.md`, and what is deferred to later phases.
- [06-economics-and-monetization.md](06-economics-and-monetization.md): a
  measured cost study of what a finished video really costs (a real run sample,
  provider/model prices, and the free local-tool savings), followed by a compact
  look at the harder social-media earning question.
- [07-ui-ux.md](07-ui-ux.md): the single-pane-of-glass interaction model, the
  dashboard wireframes and gate-by-gate user journey, the dark / candle-gold design
  system (the source for `DESIGN.md`), and the storage-management UX.
- [08-tech-stack.md](08-tech-stack.md): the TypeScript-unified stack (Bun, Hono,
  React, the AI SDK), the in-process stage model, the local media binaries, the
  pinned version matrix, and the containerisation analysis.

## Decisions settled at kickoff

- **Positioning:** a **human-directed digital-art engine** (AI is the tool; the
  concept and art direction are human). Core path: post the clips as digital art
  (light burden); opt-in B-roll handoff (FCPXML / CapCut) for the human-led,
  higher-monetisation route. Never a second job.
- **Posture:** phased hybrid. Orchestrator plus adapters from day one; cheapest
  viable path per stage (free API where one exists, manual web step otherwise);
  auto-publishing deferred.
- **v1 scope:** ideate to an export package (ProRes master, caption, metadata,
  optional editor project) reviewed via three gates (A concept, A.5 base image, B
  clip) in one local dashboard. Publishing is a manual step in v1.
- **Content:** a reusable, theme-agnostic engine producing varied ultra-visual
  fantasy / sci-fi shorts (no single brand); **style presets** plus an optional
  **lore bible** (serialised narrative) live in config. Content is unbranded by
  default, with an optional per-run LUT and watermark (for example on a commission).
- **Output:** portrait (1080 x 1920, 9:16) or landscape (1920 x 1080, 16:9) per
  run; a local ~120 fps **ProRes master** (mezzanine), plus an optional 1080p / 60
  fps delivery encode for posting as-is and an FCPXML project for the editor
  handoff. No `minterpolate` fallback (pass-through if no GPU).
- **Platform:** macOS / Apple Silicon (M1 Max). Local interpolation via
  `rife-ncnn-vulkan` on Metal; Flowframes (Windows only) is out. An external
  Thunderbolt NVMe SSD holds `renders/` and `ready/`: the ProRes masters fill the
  internal disk in ~40 to 50 runs (see
  [03-constraints-and-cost.md](03-constraints-and-cost.md)).
- **Stack:** one **TypeScript** application: a Bun + Hono server and a React / Vite
  dashboard sharing one `core`, with the director on the Vercel AI SDK. The only
  spawned processes are the local media binaries (`rife-ncnn-vulkan`, `ffmpeg`); no
  Python. See [08-tech-stack.md](08-tech-stack.md).
- **Director LLM:** Claude by default, abstracted behind the AI SDK's provider
  layer (Gemini swappable).
- **Identity & ownership:** operated under **Earl Grey Labs** (`earlgreylabs` on
  GitHub). The studio logo (`docs/assets/candelabrum-studio.png`) is the studio's
  outward identity only, with no connection to the video content; the operator
  dashboard stays neutral and functional.
- **Economics:** ~$0.60 to $1.00 per clip (cheap-API); the opt-in B-roll video is
  ~$3, never the $15 to $30 of a stitched pure-AI minute. View-payouts are small
  and largely closed to fully-AI content, so revenue is brand / affiliate / funnel
  / selling the art, with the human-directed-art framing as the eligibility anchor.
  See [06-economics-and-monetization.md](06-economics-and-monetization.md).
