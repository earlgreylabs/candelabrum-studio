# Constraints, trade-offs, and cost

This document captures the hard realities the source draft glosses over. They are
the reason the studio is a phased hybrid rather than either a "$0 magic box" or a
"fully automated" pipeline.

## macOS is the target, not Windows

The draft's local interpolation step assumes Windows: it names Flowframes and
`rife-ncnn-vulkan.exe`. The operator is on macOS / Apple Silicon, so:

- **Flowframes is out.** It is a Windows-only .NET GUI and will not run here.
- **`rife-ncnn-vulkan` is in.** The same RIFE engine ships as a cross-platform
  CLI that runs on the Apple GPU through Metal (via MoltenVK). This is the
  load-bearing local tool.
- **No `minterpolate` fallback.** If there is no usable GPU, the stage degrades to
  **no interpolation** (the source clip passes through as the master). FFmpeg's
  `minterpolate` is deliberately not used: too slow, and too many artifacts.

Topaz Video AI (paid, around $299 one-off, cross-platform, with interpolation
models such as Apollo and Chronos) is the commercial alternative if quality ever
demands it. The free local default stays `rife-ncnn-vulkan`.

This is a statement of fact, not a preference to debate: the build targets the
Mac-native path.

## The "$0 versus automation" contradiction

The draft contains two visions that cannot both be fully true at once:

- The **architecture** section describes a fully automated, paid-API pipeline.
- The **cost** section describes a $0 path built on free web tiers (Tensor.art,
  SeaArt, Luma, Kling web logins).

Those free tiers are **web UIs, not APIs**. They hand out daily login credits to
humans clicking buttons. Driving them programmatically either has no public API or
violates the service's terms (and invites a ban). So "free" and "fully automated"
pull in opposite directions.

**How the hybrid resolves it:** decide automation per stage, not globally.

- Stage has a free or cheap API: automate it.
- Stage only has a free web UI: the operator does that click by hand, and the
  `ManualInbox` adapter feeds the result back in. The pipeline stays uniform.
- The operator can spend money to remove a manual step at any time by switching
  that stage's adapter to a paid API. No re-architecting.

The result is genuinely near-$0 to start, with a clear, per-stage upgrade path.

## Publishing APIs are app-review-gated

Auto-publishing is neither free nor instant, which is why it is a later phase:

- **Instagram Reels (Meta Graph API):** requires a Business or Creator account
  connected to a Facebook Page, a Meta app, and App Review approval for the
  content-publishing permission. The flow is two-step (create a media container,
  then publish it) with its own rate limits.
- **TikTok (Content Posting API):** an unaudited app can only post to a private
  draft or `SELF_ONLY` visibility until it passes TikTok's audit. Direct public
  posting needs that approval.

Until those approvals exist, the honest end state is "staged for publish, operator
uploads manually", which is exactly where v1 stops.

## Terms of service and account risk

The studio assists; the operator owns the risk. Worth stating plainly in the
concept so it is a conscious choice, not a surprise:

- High-volume automated posting of AI-generated content can trip platform spam and
  authenticity controls.
- Scripting a service's free web tier to dodge its API pricing is usually a terms
  violation and a ban risk.
- The human gates exist partly for quality and partly so a person is always
  the one choosing to publish.

## Output specification

Videos ship in **portrait or landscape**, chosen per run, targeting TikTok and
Instagram. The platform numbers below are current (2026) guidance (sources at the
end of the section); they live as named constants and a per-run `OutputProfile`,
never as magic numbers scattered through the code.

### Platform delivery specs

| Orientation | Aspect | Delivery size | Safe zone (keep key content clear)                              |
| ----------- | ------ | ------------- | -------------------------------------------------------------- |
| Portrait    | 9:16   | 1080 x 1920   | IG ~1080 x 1420 centre; TikTok ~370 px off bottom, ~180 px off right (caption bar + action icons) |
| Landscape   | 16:9   | 1920 x 1080   | titles ~5% in from each edge; TikTok letterboxes unless > 60 s full-screen, fine in IG feed |

Universal delivery: **H.264 / AAC in MP4, 1080p, <= 60 fps.** Both platforms cap
display at **1080p and 60 fps**, so anything larger is downsampled on upload.

### Master vs delivery (what "4K / 120fps / 144Hz" really mean)

The viral tags are half algorithm-bait, half real technique. The real part drives
the local **master**, from which the platform-facing outputs are derived:

- **Master** (kept locally): interpolated to a high frame rate (~120 fps),
  optionally upscaled, and encoded as a **mezzanine** (Apple ProRes 422 HQ or
  high-profile HEVC) so there is no generational loss before platform compression.
  This is the archival source and the file handed to an editor for the B-roll path.
- **Delivery** (optional, for posting as-is): transcoded to the platform cap,
  **1080p at a clean 60 fps** (H.264 / AAC). Rendering at 120 fps then downsampling
  to 60 removes the microstutter the platform compressor would otherwise introduce;
  mastering above 1080p mainly buys a higher-bitrate 1080p stream after re-encode,
  not literal 4K on screen. "144Hz / 140p" are tags, not output targets.

### Named constants

| Constant                | Value    | Meaning                                  |
| ----------------------- | -------- | ---------------------------------------- |
| `CLIP_LENGTH_SECONDS`   | `~4-5`   | raw generation length                    |
| `SOURCE_FPS`            | `~24-30` | as returned by the video provider        |
| `MASTER_FPS`            | `120`    | after local interpolation (archival)     |
| `INTERPOLATION_FACTOR`  | `4`      | RIFE multiplier (the draft's `-n 4`)     |
| `DELIVERY_FPS`          | `60`     | platform display cap; the upload target  |
| `DELIVERY_MAX_HEIGHT`   | `1080`   | platform display cap                     |
| `POLL_INTERVAL_SECONDS` | `15`     | async video status polling cadence       |

`MASTER_FPS` and `INTERPOLATION_FACTOR` are linked (30 x 4 = 120); the factor is
chosen to hit the master target from whatever `SOURCE_FPS` the provider returns.
Orientation, delivery size, and safe zone are carried by the run's `OutputProfile`,
not hard-coded.

Sources: [TikTok & Reels aspect-ratio guide, 2026](https://medium.com/@AlexanderErshov/tiktok-reels-aspect-ratio-guide-every-size-for-every-platform-in-2026-2bbf5d902dba),
[TikTok video size guide](https://riverside.com/blog/tiktok-video-size),
[Instagram Reels dimensions, 2025](https://predis.ai/resources/instagram-reels-dimensions/).

## Cost model (summary)

Production is cheap and dominated by video generation; interpolation is free
because it runs locally. Per finished video: **~$0** on the free / manual route
(capped by free daily credits to a few clips a day), **~$0.60 to $1.00** cheap-API,
**~$1.20 to $2.00+** premium. The hybrid lets the operator buy down exactly the
bottleneck stage when volume justifies it.

A clip is one art piece (one image, one short animation), so per-clip cost stays in
that range. Stitching 12 to 15 clips into a single 60-second pure-AI video to chase
TikTok Creator Rewards would cost $15 to $30 and invite demonetization; the opt-in
B-roll path (2 to 3 clips intercut with human footage) keeps a monetisable video
near $3.

Full production economics, platform monetization, and the AI-content eligibility
realities live in
[06-economics-and-monetization.md](06-economics-and-monetization.md). The short
version: making videos is cheap, making money from them is the hard part.
