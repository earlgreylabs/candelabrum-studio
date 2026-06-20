# Architecture: one TypeScript app, local media subprocesses

The shape is deliberately anti-overengineered: a **single TypeScript
application** that serves the dashboard, owns the run model and state, talks to
the cloud providers, and advances the pipeline. The only things it shells out to
are the two local media binaries (`rife-ncnn-vulkan` and `ffmpeg`), because they
are native GPU/CPU tools, not libraries. There is no second language, no task
queue, and no database: state is JSON on disk and the runtime stays out of the
way so the Apple GPU is free for rendering.

```
   [ Browser: React + Vite dashboard — Gates A / A.5 / B + lore chat ]
               ^   HTTP + SSE  (run state · stage progress · subprocess stdout)
               v
   [ Hono server on Bun — one TypeScript app ]
     core (run model · state · config) · Director chat (Vercel AI SDK)
     · provider adapters · advances the pipeline · serves the dashboard
               |
               v
   [ Pipeline stages — in-process TypeScript modules, one per stage ]
       direct        image        animate        interpolate       export
         |             |             |                |               |
         v             v             v                v               v
     DirectorLLM    Image API    Video API       subprocess:      Exporter
      (AI SDK)     (fal/Repl.)   (fal/Kling)     rife-ncnn  +     (ffmpeg +
                  or ManualInbox or ManualInbox  ffmpeg (local)   FCPXML writer)

   Cloud (network only):  Claude / Gemini · FLUX.2 · Kling / Runway
   Local (spawned):       rife-ncnn-vulkan (Metal via MoltenVK) · ffmpeg
```

Why not the older "Python scripts behind a TS shell" sketch: the only reason to
reach for Python was that the generation SDKs used to be Python-first. They are
not anymore (the Anthropic, fal, Replicate, and Runway clients are all
first-class TypeScript), so a second runtime would buy nothing and cost a
toolchain, a dependency tree, and a language boundary through the run state. One
language, one process, two spawned binaries.

## Adapter interfaces

Each stage depends on an interface, not a vendor. The contracts are small on
purpose, and are TypeScript interfaces in `core`.

- **DirectorLLM**: `proposeConcepts(style, history, n)`, `revise(concept,
  instruction)`, `finalise(concept) -> ShotSpec`, `caption(shotSpec, platform)`.
  Realised through the **Vercel AI SDK**, whose provider abstraction is exactly
  the "swap Claude for Gemini in config, not code" requirement; streaming feeds
  the Gate A chat.
- **ImageProvider**: `generate(shotSpec) -> ImageArtifact` (path, resolved seed,
  provider id, cost).
- **VideoProvider** (asynchronous): `submit(image, motionPrompt) -> taskId`,
  `poll(taskId) -> Status | resultUrl`. The orchestrator owns the download once
  the job succeeds.
- **Exporter**: `package(run) -> ExportPackage` (writes the **flat** ProRes
  master, caption, metadata, and an optional editor project: FCPXML or a CapCut
  draft), plus an optional `delivery(master, profile) -> Path` for a direct
  post-as-is encode. Colour grading is delivery-only; see the grading rule below.
- **Publisher** (later phase): `publish(postPackage, platform) -> PostResult`.

### Manual steps are adapters too

The phased-hybrid posture means some stages have no usable API and the operator
does them by hand. Rather than branch the pipeline on auto-versus-manual, a manual
step is implemented as an adapter (`ManualInbox`) that satisfies the same
interface: it shows the operator what to make and where to drop the result, then
watches the run's inbox directory and returns the dropped file as the artifact.
The drop happens inside the dashboard (a drag-and-drop zone), not in the Finder.
The orchestration code stays uniform; swapping a paid API in later is a config
change.

## Colour grading is delivery-only (no baked master)

A hard rule, because it is easy to get wrong: the **ProRes master stays flat and
ungraded.** Baking a 3D LUT into the ProRes 422 HQ master with `ffmpeg`
destructively clamps colour and luma and defeats the point of a mezzanine, and
piping a 120 fps ProRes stream through `ffmpeg`'s software `lut3d` filter pulls
the encode out of VideoToolbox hardware acceleration and stalls the M1. So:

- The optional per-run **LUT and watermark apply only to the H.264/AAC delivery
  encode**, never to the master.
- The **FCPXML editor project references the ungraded master** and carries the
  LUT as non-destructive metadata, so the editor sees full latitude.

This is a hard contract rule, not a nicety.

## Run model and durable state

A **Run** is the unit of work and the unit of resumption:

```
Run {
  id            # timestamped, unique
  style         # which style preset (if any) produced it
  lore          # optional campaign directive for serialised concepts
  status        # the current Stage / gate (enum, incl. A.5); drives resume
  shotSpec      # the approved prompt bundle (includes orientation)
  profile       # OutputProfile: orientation -> delivery size, fps cap, safe zone
  artifacts     # { image, rawClip, masterClip (ProRes, flat), exportPackage }
  events        # append-only log of stage / gate transitions + operator actions
  cost          # per-stage provider + spend
  createdAt
}
```

The `OutputProfile` maps the chosen orientation to the concrete delivery size,
frame-rate cap, and safe zone (see
[03-constraints-and-cost.md](03-constraints-and-cost.md)). The interpolation
master is profile-independent; only the delivery encode at packaging is not.

State is persisted to `runs/<id>/metadata.json` after every stage transition. On
start the orchestrator can resume any run from its `status`. The status enum is
the single source of "where this run is"; there is no separate progress flag to
drift out of sync.

## Asynchronous video handling

Video generation is async and can take minutes. The orchestrator never hangs on a
synchronous wait. v1 uses a clean polling loop: submit, then check the status
endpoint on a fixed interval (`POLL_INTERVAL_SECONDS`, default 15) until the job
returns success with a download URL, with a timeout and a bounded retry. A webhook
listener is a later-phase optimisation, not a v1 requirement.

## Subprocess lifecycle (memory hygiene)

`rife-ncnn-vulkan` pools GPU/unified memory aggressively. On a 32 GB machine with
limited disk for swap, the orchestrator must **fully terminate the `rife`
subprocess and let its memory release before spawning the `ffmpeg` encode**, so
the two never contend and the SSD does not thrash. Stages run one
heavy subprocess at a time, awaited to exit, never overlapped.

## Local versus cloud split

- **Cloud:** ideation (LLM), image generation, video generation. These are
  model-heavy and not worth running locally.
- **Local:** orchestration, state, the review dashboard, and frame interpolation
  plus encode. Interpolation is the one heavy compute step kept local, on the
  Apple Silicon GPU, precisely because doing it in the cloud is where cost would
  accumulate. This is also why the runtime is not containerised; see the
  containerisation note in [08-tech-stack.md](08-tech-stack.md).

## The metadata and learning cache

Every run writes a complete record: the seed, every prompt variant the director
produced, the operator's feedback at each gate, the provider used per stage, and
the cost. This is both the resume state and the raw material for later analysis of
which prompt structures yield the clips worth keeping. v1 stores it as the
per-run `metadata.json`; a queryable index (Bun's built-in SQLite over those
records) is a later-phase concern, not a v1 dependency.

## Review surface and design direction

The dashboard is the **single operator surface** for the whole run: Gate A
(pick and iterate a concept), Gate A.5 (approve the base image), Gate B (approve
the finished clip), and any manual-inbox drops all happen here, not split across a
CLI and the Finder. It shows a list (and a kanban) of runs awaiting action, an
inline image and clip viewer (portrait or landscape) with the safe zone overlaid,
the editable caption, a persistent storage gauge, and the approve / regenerate /
revise actions. Gates are batchable and keyboard-driven: the operator can clear
several runs in one short sitting, which is what keeps the tool from feeling like a
second job. The full interaction model is in [07-ui-ux.md](07-ui-ux.md).

It is the one real UI in the product. Because the content is deliberately varied
(no fixed palette), the tool stays neutral on purpose: a restrained, functional
**near-black** surface with generous whitespace, confident typography, and a
single warm **candle-gold** accent drawn from the logo, so a clip of any aesthetic
reads clearly against it. The studio logo brands the tool's chrome, but the studio
identity does not bleed into the content by default (an optional, operator-set
per-run watermark aside). Concrete tokens live in `DESIGN.md`, sourced from the
design system in [07-ui-ux.md](07-ui-ux.md) and reconciled by `/sync-protocols`;
this document only fixes the direction.

## Directory layout (sketch, not law)

```
candelabrum-studio/
  config/
    styles/cosmic-scifi.toml      # a reusable style preset (looks vary per run)
    settings.toml                 # defaults: providers, fps targets, paths
  src/
    core/                         # run model, state, config (Zod), costs
    stages/                       # direct, image, animate, interpolate, export
    providers/                    # llm/, image/, video/, export/, publish/ + manual
    server/                       # Hono app: dashboard API + SSE
    web/                          # React + Vite dashboard: gates A / A.5 / B
    cli.ts                        # the orchestrator entrypoint (headless runs)
  runs/<id>/                      # per-run artifacts + metadata.json
  renders/{raw,master}/           # working video + flat ProRes masters
  ready/                          # approved export packages (v1 terminal state)
```

Organisation is stage-first (each stage is its own module); adapters are grouped
by the interface they implement. Human-edited config is **TOML** (validated with
Zod at load). `renders/` and `ready/` default to the external SSD (see
[03-constraints-and-cost.md](03-constraints-and-cost.md)). Secrets (provider keys)
live in a gitignored `.env`, never in `config/` and never committed.
