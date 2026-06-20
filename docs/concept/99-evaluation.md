# Candelabrum Studio: Expert Panel Evaluation

An evaluation of the Candelabrum Studio concept documentation was conducted by a panel of six specialized AI personas representing different industry perspectives. Their goal was to critique the system’s architecture, pipeline, economics, and usability.

## The Panel

1. **Social Media Creator:** Focused on daily content creation workflows, speed to publish, and trend-jacking.
2. **Influencer:** Evaluated audience engagement, brand safety, virality, and community building.
3. **Media Director:** Reviewed the tool for professional agency use, production value, and campaign consistency.
4. **Social Media Economist:** Analyzed the monetization strategy, ROI, unit economics, and platform algorithms.
5. **Video Engineer:** Critiqued the rendering pipeline, codec choices, fallback logic, and system architecture.
6. **UI/UX Designer:** Focused on cognitive load, the user journey across the application's states, and accessibility.

---

## 1. Core Strengths Identified

The panel was unanimous in praising several architectural decisions:

- **The Orchestration Leverage:** Eliminating the "seven-app juggling slog" of modern AI video creation is the strongest value proposition of the studio.
- **The "Two Gates" Strategy:** The Influencer and Creator strongly praised the human-in-the-loop design (Gate A for concept, Gate B for delivery). It protects brand safety by preventing automated "AI slop" from ruining algorithmic momentum.
- **Economic Realism:** The Economist praised the documentation's blunt assessment that platform views do not pay for AI content.
- **Adapter Pattern (ManualInbox):** The Engineer and UX Designer commended the architecture that treats manual web-UI drop-ins as an asynchronous adapter, preventing API lock-in.

---

## 2. Key Tensions & Strategic Resolutions

Following the initial critique, the panel held a discussion to resolve three major strategic tensions. The consensus dictates the following pivots for the project's roadmap:

### Tension A: The 60-Second Dilemma vs. Unit Economics

- **The Problem:** TikTok's monetization requires videos over 60 seconds. The Creator wanted to stitch 12-15 generated clips together to hit this wall. However, the Economist pointed out that generating 15 clips costs $15–$30 per video—completely destroying the unit economics and risking platform demonetization.
- **The Consensus Resolution: The Hybrid Workflow.** The tool should _not_ attempt to generate 60 seconds of pure AI video. It should embrace its role as a high-end **B-Roll Engine**. Operators should film 60 seconds of cheap, human-led A-roll (e.g., a talking head) and use Candelabrum to generate 2-3 high-impact, 5-second B-roll clips to intercut. This drops generation costs to ~$3, secures monetization compliance, and maintains viewer retention.

### Tension B: The Missing Audio & The "NLE Trap"

- **The Problem:** Short-form video is an audio-first medium. Candelabrum currently outputs silent, 5-second MP4s. Creators noted this forces them back into CapCut, defeating the "one tool" vision.
- **The Consensus Resolution: Export, Don't Build.** The panel (specifically the Engineer and UX Designer) strongly advised _against_ building a timeline editor (NLE) within Candelabrum. It leads to scope bloat and terrible UX. Instead, Candelabrum should export a **CapCut Project Folder or Premiere/FCPXML file**. Generate the high-fidelity clips and the captions, and hand them off cleanly to dedicated editing software where the operator can add trending audio.

### Tension C: The Parasocial Deficit

- **The Problem:** The architecture relies on "deliberately varied" visual prompts (a boat today, a spaceship tomorrow). The Influencer and Media Director noted that random aesthetic footage fails to build a brand, lore, or parasocial trust with an audience.
- **The Consensus Resolution: Narrative & Color Consistency.** Do not attempt to use complex, brittle AI models (like custom LoRAs) for visual character consistency. Instead, achieve consistency through two low-friction methods:
  1. **Narrative Consistency (Gate A):** Supply the Director LLM with a "Lore Bible" or Campaign directive so it generates serialized, sequential concepts (e.g., "Day 42 in the wasteland"). Storytelling creates audience investment regardless of the visuals.
  2. **Post-Processing Consistency (Gate B):** The Video Engineer recommended applying a signature studio LUT (color grade) and consistent watermarks/UI overlays via `ffmpeg` during the final encode.

---

## 3. Technical & UX Action Items

- **Kill `minterpolate`:** Remove FFmpeg's `minterpolate` as a fallback. It is too slow and produces too many artifacts. Default to no interpolation if the GPU is unavailable.
- **Mezzanine Codecs:** The local master files must be encoded in Apple ProRes 422 HQ or High-Profile HEVC to prevent generational loss before platform compression.
- **Gate A Visuals:** The UX Designer recommends adding a "Gate A.5" to approve the base image _before_ committing to expensive video generation, reducing cognitive anxiety.
- **Unified Web Dashboard:** Move the CLI concept approval and the Finder-based `ManualInbox` interactions into the Web Dashboard to eliminate the fragmented user journey.
