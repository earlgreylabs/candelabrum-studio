# Pipeline: the stages and the gates

The studio is a linear pipeline with three human gates (concept, base image,
clip). Each stage has a defined
input and output artifact, so any stage can be run, retried, or swapped
independently. Artifacts live on disk under a per-run directory; the orchestrator
advances a run stage by stage and persists state after each, so a crash resumes
rather than restarts (see [02-architecture.md](02-architecture.md) for the run
and state model).

```
            [ trigger: command / cron ]
                       |
                       v
        +--> [ 1. Direct  (director LLM, optional lore bible) ] <--+
        |              |                                           |  iterate
        +-- GATE A: concept approval ------------------------------+
                       |  (approved shot spec)
                       v
              [ 2. Image  (base still) ]
                       |
                       v
        +-- GATE A.5: base-image approval -----+
        |              |                       |  cheap re-roll before video spend
        +-- (regenerate image) ----------------+
                       |  (approved image)
                       v
              [ 3. Animate  (image -> video, async) ]
                       |
                       v
              [ 4. Interpolate  (local GPU -> ~120fps ProRes master) ]
                       |
                       v
        +-- GATE B: clip approval -------------+
        |              |                       |  request revision
        +-- (reject / re-run earlier stage) ---+
                       |  (approved clip)
                       v
              [ 5. Caption ]
                       |
                       v
              [ 6. Export package  (master + caption + editor project) ]  <-- v1 STOPS (manual post)
                       |
                       v
              [ 7. Publish ]  <-- later phase (gated platform APIs)
```

## 1. Direct: the creative director

- **Purpose:** propose a few distinct concept variants for the day (optionally
  anchored to a style preset), then iterate on the chosen one in natural language
  until the operator approves a final visual prompt.
- **Input:** an optional style preset (aesthetic, prompt scaffolding), an optional
  **lore bible / campaign directive** (for serialised, sequential concepts that
  build a narrative), any operator steer, and recent history (to avoid repeating
  yesterday).
- **Output:** an approved **shot spec**: `{ image_prompt, motion_prompt,
  caption_draft, style, orientation, seed_hint }`. `orientation` (portrait or
  landscape) sets the image aspect and the delivery profile downstream.
- **Automation:** auto (API). Default provider Claude, abstracted behind the
  director adapter.
- **Gate A:** the operator picks a variant or replies with edits ("more synthwave
  purple, less orange"); the agent revises; the loop ends on `approve`.

## 2. Image: the base still

- **Purpose:** render the base still from `image_prompt`, at the run's aspect
  (portrait 9:16 or landscape 16:9).
- **Input:** the shot spec.
- **Output:** base image plus the resolved seed, in the run directory.
- **Automation:** auto where an image API is configured (for example Flux.1 via
  fal, Replicate, Together, or ModelsLab). Manual fallback: the operator
  generates on a free tier (Tensor.art, SeaArt, a Hugging Face Space) and drops
  the file into the run's inbox; the manual inbox is itself an adapter.
- **Why a still first:** feeding a text prompt straight into a video model warps
  the subject (it melts, fine detail crawls). A crisp, flawless base image locks
  the structure first, so the next stage only has to move the camera. This is the
  source of the sharpness in the reference clips.

## Gate A.5: base-image approval

A cheap checkpoint before the one expensive step. The operator approves the base
still (or re-rolls it for pennies) **before** any video generation is spent on it.
Image generation costs cents while video costs the most of any stage, so catching a
weak composition here, not after a dollar of animation, is the highest-leverage
gate in the pipeline. Low friction: one glance, approve or regenerate, in the same
dashboard as the other gates.

## 3. Animate: image to video

- **Purpose:** animate the still into a short clip (about four to five seconds)
  per `motion_prompt` (for example "camera pushes forward, vehicle stays stable").
- **Input:** base image plus `motion_prompt`.
- **Output:** raw clip (`.mp4`), typically around 24 to 30 fps, in `renders/raw/`.
- **Automation:** auto where a video API is configured (Runway, Kling, via their
  SDK or a unified endpoint such as fal or Wavespeed). Manual fallback: the
  operator uses a free tier (Luma Dream Machine, Kling web) and drops the file
  back.
- **The speed illusion:** for forward-travel concepts, the prompt holds the
  subject (a rider, a boat, a ship) static and flies the world past it, which
  reads as speed. Favour providers strong at forward camera travel.
- **Note:** this is the asynchronous stage. The orchestrator never blocks on it;
  it polls the task status until the job succeeds, then downloads. See the async
  handling in [02-architecture.md](02-architecture.md).

## 4. Interpolate: local frame interpolation

- **Purpose:** raise the frame rate for smooth motion (`SOURCE_FPS` to
  `MASTER_FPS`, for example 30 to 120), run locally to avoid cloud cost. The output
  is the local **master** (mezzanine quality); platform-facing encodes are produced
  at packaging (stage 6). See the master-versus-delivery split in
  [03-constraints-and-cost.md](03-constraints-and-cost.md).
- **Input:** the raw clip.
- **Output:** the high-frame-rate **ProRes 422 HQ** (or high-profile HEVC) master
  in `renders/master/`, encoded mezzanine to avoid generational loss before any
  platform compression.
- **Automation:** auto, as a local subprocess. Mac-native path: `rife-ncnn-vulkan`
  (the CLI engine behind Flowframes) on Metal via MoltenVK. If no usable GPU, the
  stage degrades to **no interpolation** (the source passes through as the master).
  `ffmpeg minterpolate` is deliberately not used: too slow, too many artifacts.
- **Note:** the draft's `-n 4` (multiply frames by four) maps to the RIFE
  multiplier flag (RIFE model configurable); an optional resolution upscale can
  run in the same step. Exact tools and flags are pinned in
  [04-technical-spec.md](04-technical-spec.md).

## Gate B: clip approval

The pipeline pauses. A notification fires (a macOS notification plus an entry in
the local review dashboard). The operator watches the interpolated clip and either
approves it, rejects it (discard the run), or requests a revision (re-run from an
earlier stage with a note). Nothing proceeds without an approval.

## 5. Caption

- **Purpose:** finalise the caption and hashtags from `caption_draft`, tuned to
  each platform's conventions.
- **Automation:** auto (director LLM), editable by the operator at gate B.

## 6. Export package

- **Purpose:** assemble the run's output into `ready/`: the **ProRes master**, the
  caption, and metadata. Two ways out, both from the same package:
  - **Post as digital art (default):** an optional direct **delivery** encode
    (H.264 / AAC MP4, 1080p, <= 60 fps, key content inside the safe zone) for clips
    the operator posts as-is.
  - **B-roll handoff (opt-in):** an **editor project** (FCPXML, or a CapCut draft)
    that references the master and caption, so the operator can intercut it with
    their own footage and add trending audio in CapCut / Premiere / Resolve.
- The studio does **not** build a timeline editor. A **LUT and watermark are
  optional per run** (off by default, applied at encode, for example a watermark on
  a commission), so content is unbranded unless the operator opts in. **In v1 this
  is the terminal state:** posting is manual from here.

## 7. Publish: later phase

- **Purpose:** push the package to platforms. Reels via the Meta Graph API
  (`/media` then `/media_publish`); TikTok via the Content Posting API (draft or
  direct).
- **Automation:** deferred. Gated behind platform app review and business or
  creator accounts. See [03-constraints-and-cost.md](03-constraints-and-cost.md)
  and [05-scope-and-phases.md](05-scope-and-phases.md).

## What v1 implements

Stages 1 through 6, all three gates (A, A.5, B) in one local dashboard, and the
metadata record. The export package (master, caption, metadata, optional editor
project) is the v1 output; Gate B is the operator's last action and stage 7 is out
of scope for v1.
