# Architecture: orchestrator, adapters, and state

The shape is deliberately boring: a single-process local orchestrator that drives
a run through the pipeline stages, talking to the outside world only through
narrow adapter interfaces. The orchestrator owns sequencing, state, and the two
human gates. Everything vendor-specific lives behind an adapter.

```
   [ CLI / cron: trigger ]   [ local web dashboard: gates A / A.5 / B + manual drops ]
              |                                  |
              v                                  v
            +-------------------------------------------------+
            |                 Orchestrator                    |
            |  run model · stage sequencing · gates · state   |
            |  async polling · metadata + cost record         |
            +-------------------------------------------------+
              |        |         |          |         |        |
              v        v         v          v         v        v
          Director  Image     Video    Interpolate  Export  Publisher
            LLM    provider  provider    (local)    adapter  (later)
          adapter  adapter   adapter    subprocess  (FCPXML) adapter
              |        |         |          |
           Claude/   Flux via  Runway/   rife-ncnn-vulkan
           Gemini    fal,...   Kling,..  (Metal), else
                     or Manual or Manual pass-through
                     inbox     inbox
```

## Adapter interfaces

Each stage depends on an interface, not a vendor. The contracts are small on
purpose.

- **DirectorLLM**: `propose_concepts(style, history, n)`, `revise(concept,
  instruction)`, `finalise(concept) -> ShotSpec`, `caption(shot_spec, platform)`.
- **ImageProvider**: `generate(shot_spec) -> ImageArtifact` (path, resolved seed,
  provider id, cost).
- **VideoProvider** (asynchronous): `submit(image, motion_prompt) -> task_id`,
  `poll(task_id) -> Status | result_url`. The orchestrator owns the download once
  the job succeeds.
- **Exporter**: `package(run) -> ExportPackage` (writes the ProRes master, caption,
  metadata, an optional editor project: FCPXML or a CapCut draft, and applies an
  optional per-run LUT and watermark at encode), plus an optional
  `delivery(master, profile) -> Path` for a direct post-as-is encode.
- **Publisher** (later phase): `publish(post_package, platform) -> PostResult`.

### Manual steps are adapters too

The phased-hybrid posture means some stages have no usable API and the operator
does them by hand. Rather than branch the pipeline on auto-versus-manual, a manual
step is implemented as an adapter (`ManualInbox`) that satisfies the same
interface: it shows the operator what to make and where to drop the result, then
watches the run's inbox directory and returns the dropped file as the artifact.
The orchestration code stays uniform; swapping a paid API in later is a config
change.

## Run model and durable state

A **Run** is the unit of work and the unit of resumption:

```
Run {
  id            # timestamped, unique
  style         # which style preset (if any) produced it
  lore          # optional campaign directive for serialised concepts
  status        # the current Stage / gate (enum, incl. A.5); drives resume
  shot_spec     # the approved prompt bundle (includes orientation)
  profile       # OutputProfile: orientation -> delivery size, fps cap, safe zone
  artifacts     # { image, raw_clip, master_clip (ProRes), export_package }
  events        # append-only log of stage / gate transitions + operator actions
  cost          # per-stage provider + spend
  created_at
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

## Local versus cloud split

- **Cloud:** ideation (LLM), image generation, video generation. These are
  model-heavy and not worth running locally.
- **Local:** orchestration, state, the review dashboard, and frame interpolation.
  Interpolation is the one heavy compute step kept local, on the Apple Silicon
  GPU, precisely because doing it in the cloud is where cost would accumulate.

## The metadata and learning cache

Every run writes a complete record: the seed, every prompt variant the director
produced, the operator's feedback at each gate, the provider used per stage, and
the cost. This is both the resume state and the raw material for later analysis of
which prompt structures yield the clips worth keeping. v1 stores it as the
per-run `metadata.json`; a queryable index (for example SQLite over those records)
is a later-phase concern, not a v1 dependency.

## Review surface and design direction

The dashboard is the **single operator surface** for the whole run: Gate A
(pick and iterate a concept), Gate A.5 (approve the base image), Gate B (approve
the finished clip), and any manual-inbox drops all happen here, not split across a
CLI and the Finder. It shows a list of runs awaiting action, an inline image and
clip viewer (portrait or landscape) with the safe zone overlaid, the editable
caption, and the approve / regenerate / revise actions. Gates are batchable: the
operator can clear several runs in one short sitting, which is what keeps the tool
from feeling like a second job.

It is the one real UI in the product. Because the content is deliberately varied
(no fixed palette), the tool stays neutral on purpose: a restrained, functional
dark surface with generous whitespace, confident typography, and flat honest
surfaces, so a clip of any aesthetic reads clearly against it. The studio logo
brands the tool's chrome, but the studio identity does not bleed into the content
by default (an optional, operator-set per-run watermark aside).
Concrete tokens belong in `DESIGN.md`, populated from this intent by
`/sync-protocols`; this document only fixes the direction.

## Directory layout (sketch, not law)

```
candelabrum-studio/
  config/
    styles/cosmic-scifi.toml      # a reusable style preset (looks vary per run)
    settings.toml                 # defaults: providers, fps targets, paths
  src/studio/
    core/                         # run model, state, config, costs
    stages/                       # direct, image, animate, interpolate, export
    providers/                    # llm/, image/, video/, export/, publish/ + manual
    dashboard/                    # local web app: gates A / A.5 / B + manual drops
    cli.py                        # the orchestrator entrypoint
  runs/<id>/                      # per-run artifacts + metadata.json
  renders/{raw,master}/           # working video + ProRes masters
  ready/                          # approved export packages (v1 terminal state)
```

Organisation is stage-first (each stage is its own module); adapters are grouped
by the interface they implement. Secrets (provider keys) live in a gitignored
`.env`, never in `config/` and never committed.
