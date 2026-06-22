# UI, UX, and the User Journey

This document outlines the interaction model, user interface wireframes, and the end-to-end user journey for Candelabrum Studio.

The core philosophy of the UI is the **Single Pane of Glass**. Previous AI video workflows required users to juggle a terminal (for LLM prompting), a browser (for web UI generation), Finder (for file management), and an NLE (for editing). Candelabrum Studio consolidates orchestration, review, and manual fallbacks into a single, cohesive local Web Dashboard.

## 1. Interaction Philosophy & Design System

- **Restrained Aesthetic:** The UI is a functional, **near-black** surface with a
  single warm **candle-gold** accent drawn from the logo's flames. The interface
  must recede so the highly saturated, variable video content becomes the focal
  point; the accent appears only on interactive affordances, never as decoration.
- **Keyboard-Driven Batching:** Because platform payouts are microscopic, the tool must support high-volume curation. The user should be able to review 20 clips using only the keyboard (`Space` to play/pause, `Y` to approve, `N` to reject).
- **Proactive Anxiety Reduction:**
  - **Gate A.5:** Shows the static image before the expensive video generation begins.
  - **Safe-Zones:** Overlays TikTok/IG UI elements over the video player so text isn't cut off.
  - **Storage Gauge:** A persistent meter preventing the "Disk Full" panic.

### Design System (the source for `DESIGN.md`)

The tokens below are the design source of truth; `/sync-protocols` compiles them
into `DESIGN.md`. Built with Tailwind CSS v4 + shadcn/ui (see
[08-tech-stack.md](08-tech-stack.md)). The palette is **dark by default** (the
operator stares at it for long sittings) and derives from the logo: a wrought-iron
candelabrum and gold flames against a cosmic nebula. Only the gold is borrowed for
chrome; the nebula colours stay in the logo so the UI never competes with content.

**Colour — neutral near-black base, one gold accent.**

| Token              | Value     | Use                                                    |
| ------------------ | --------- | ------------------------------------------------------ |
| `background`       | `#0C0C0E` | app base (near-black, faintly neutral)                 |
| `surface`          | `#15151A` | panels, cards, sidebar                                 |
| `surface-raised`   | `#1C1C22` | modals, popovers, menus                                |
| `border`           | `#2A2A31` | hairlines, dividers                                    |
| `text`             | `#ECEAE6` | primary text (warm off-white, not clinical white)      |
| `text-muted`       | `#9A968E` | metadata, labels, secondary text                       |
| `text-faint`       | `#6B6862` | timestamps, disabled                                   |
| `accent`           | `#E3A93C` | candle gold: buttons, links, focus, active state       |
| `accent-hover`     | `#F0C063` | hover                                                  |
| `accent-active`    | `#C2882B` | pressed                                               |
| `accent-foreground`| `#1A1505` | text/icon on a gold fill                               |

**Status colours** (kept distinct from the gold accent, which means "action," not
"state"):

| Token       | Value     | Meaning                                                |
| ----------- | --------- | ------------------------------------------------------ |
| `rendering` | `#5AB0C9` | in-progress / generating (cool nebula cyan)            |
| `ready`     | `#5BA66E` | approved / ready                                       |
| `warning`   | `#E07B39` | storage gauge ≥ 80% (a hotter orange, not the accent)  |
| `danger`    | `#C4452E` | reject / trash, storage gauge ≥ 90% (logo terracotta)  |

**Typography.** UI: **Inter** (variable) for everything functional, base **14 px**
with a generous line-height and spacing scale (clarity and whitespace over
density). Technical fields (seeds, costs, run ids, timestamps): **JetBrains Mono**.
The ornate logo wordmark is never used as a UI typeface; the chrome stays neutral.

**Components.** shadcn/ui primitives, themed to the tokens above: flat honest
surfaces (no heavy shadows or gradients), 1 px borders, a single radius scale, and
a visible gold focus ring on every interactive element for the keyboard-first
flow. The candle-gold accent is reserved for the one primary action in any view;
secondary actions are neutral ghost buttons.

## 2. Dashboard Wireframe & Global Layout

The application utilizes a classic sidebar navigation model with a persistent top chrome for system status.

```text
+-----------------------------------------------------------------------------------+
|  [Candelabrum Logo]           Status: Idle/Rendering        Storage: 82% Full ⚠️  |
+--------------------------+--------------------------------------------------------+
|                          |                                                        |
|  Pipeline Board          |                                                        |
|  Gate A: Direct          |                                                        |
|  Gate A.5: Base Image    |                                                        |
|  Gate B: Clip Review     |      [ Context-dependent view renders here ]           |
|  History & Analytics     |                                                        |
|  Settings & Lore         |                                                        |
|  Storage Manager 🗑️      |                                                        |
|                          |                                                        |
+--------------------------+--------------------------------------------------------+
```

## 3. The User Journey (The Gates)

The user journey is defined by the "Gates"—the points where the orchestration pauses and requires human approval.

Every run detail view includes a keyboard-accessible pipeline progress stepper:
Direct, Gate A, Image, Gate A.5, Upscale, Animate, Interpolate, Gate B, Caption,
Export.
Selecting a step opens an anchored explanation panel showing its purpose, input,
output, cost behavior, selected provider/model, and current failure or fallback.

Every action that may invoke a model shows only providers capable of that
operation, its resolved model, availability, and estimated cost when known. The
provider choice and approval are submitted atomically. Cancelling leaves the run
at its current gate; it is distinct from rejecting the run.

### Pipeline Board (Kanban View)

The default landing page. A Kanban board visualizing all active `Runs` moving from left to right.

- **Columns:** Ideation -> Awaiting Image -> Generating Video -> Awaiting Approval -> Ready/Published.
- **Action:** Clicking a card in any "Awaiting" column takes the user to the respective Gate.

### Gate A: The Director (Concept Approval)

Where the human acts as the Creative Director alongside the LLM.

- **Layout:** A split-pane. Left side is the chat interface with the Director LLM. Right side is the "Shot Spec" form.
- **UX:** The user selects a "Lore Bible" (e.g., "Season 1: Neon Desert") from a dropdown. The LLM pitches 3 concepts. The user types, "Make concept 2 more aggressive." The LLM updates the Shot Spec on the right.
- **Action:** User clicks **[Approve & Generate Base Image]**.

### Gate A.5: Base Image Approval

The cheapest, highest-leverage gate. Prevents burning API credits on bad compositions.

- **Layout:** A large, uncropped image viewer.
- **Manual Inbox Friction-Killer:** If the pipeline is configured to use a free web tier (e.g., SeaArt) instead of an API, a massive dashed dropzone appears: _"Drag and drop your generated image here."_ The backend automatically routes it to the correct `runs/<id>/inbox` folder.
- **Action:** **[Approve & Animate]** or **[Re-Roll Image]**.

### Gate B: The Final Clip Review

The final sign-off before export.

- **Layout:** A looping video player centered on screen.
- **Safe-Zone Toggle:** Buttons to overlay the TikTok UI (right-side buttons, bottom caption gradient) or IG Reels UI to ensure the subject isn't obscured.
- **Caption Editor:** A text box below the video to tweak the LLM-generated caption and hashtags.
- **Action:** **[Approve & Export Package]**, **[Reject & Trash]**, or **[Request Revision]**.

```text
User                  Dashboard (Hono/Bun + React)        Stage modules + local binaries
 |                              |                                       |
 |--- Select "Lore Bible" ----->|                                       |
 |                              |--- direct stage (AI SDK) ------------>| Claude/Gemini (cloud)
 |                              |<------ returns Shot Spec drafts ------|
 |                              |                                       |
 |--- "Approve Concept" ------->| (Gate A)                              |
 |                              |--- image stage (fal / FLUX.2) ------->| cloud, or ManualInbox drop
 |                              |<-------- returns base image ----------|
 |                              |                                       |
 |--- "Approve Image" --------->| (Gate A.5)                            |
 |                              |--- animate stage (submit + poll) ---->| Kling/Runway (cloud, async)
 |                              |--- spawn rife-ncnn-vulkan ----------->| local GPU (Metal)
 |                              |--- (teardown) spawn ffmpeg ---------->| local (VideoToolbox)
 |                              |<---- returns flat ProRes master ------|
 |                              |                                       |
 |--- Toggles Safe-Zones ------>|                                       |
 |--- "Approve Clip" ---------->| (Gate B)                              |
 |                              |--- export stage (ffmpeg + FCPXML) --->| local
 |                              |                                       |
```

## 4. Addressing Hardware Constraints (Storage Management)

As identified in the hardware evaluation (M1 Max, 118.7GB free disk), 120fps ProRes 422 HQ masters will fill the drive in weeks. The UX must actively mitigate this.

- **The Storage Gauge:** Always visible in the top right. Turns orange at 80% full, red at 90%. Clicking it opens the Storage Manager.
- **The Storage Manager View:**
  - Lists all runs by size.
  - **[Empty Trash]** button to delete rejected runs.
  - **[Purge Raw Clips]** button to delete the highly-compressed source MP4s for runs where the ProRes master is already approved.
  - **Auto-Prune Toggle:** A setting to automatically delete `renders/raw/` the moment Gate B is approved.
