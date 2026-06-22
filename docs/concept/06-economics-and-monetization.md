# Economics and monetization

This is a viability document, and it answers the cost question first because that
is the question the pipeline has now actually answered. **What does one finished
video cost to produce?** With a real batch of runs to measure, the answer is
concrete: about a dollar, dominated entirely by the video-generation stage, held
there by free local tooling. The harder, second question, **how could this
actually earn on social media**, is covered at the end as a separate study; it has
no clean answer because all three target platforms spent 2025 to 2026 tightening
the rules against exactly this kind of content.

Headline finding, up front: **making videos is cheap and now well-measured;
making money from them is the hard, unsettled part.** Framed as human-directed
digital art (AI is the tool; the concept and art direction are human), the work
stays platform-eligible and gains revenue doors a content-farm lacks (brand,
affiliate, an owned funnel, selling the art itself), but per-view payouts cannot
fund it on their own.

(Figures are mid-2026 orders of magnitude and move often; sources at the end.)

## 1. Production cost per video

One finished video is one base image plus one short image-to-video clip,
interpolated and encoded locally. The local steps are free, so cost is dominated
by the two cloud generations plus a small director-LLM spend.

| Stage              | Free / manual route                 | Paid-API route (per video)                              |
| ------------------ | ----------------------------------- | ------------------------------------------------------- |
| Direct (LLM)       | Gemini free tier                    | ~$0.01 to $0.05                                         |
| Image (FLUX.2)     | web tier (Tensor.art, SeaArt), $0   | ~$0.03/MP -> ~$0.06 each (a 9:16 frame ≈ 2 MP); ~$0.06 to $0.18 with retries |
| Animate (~5 s)     | Luma / Kling free credits, $0       | Kling 2.5 Turbo ~$0.07/s -> ~$0.35; Runway ~$0.15/s -> ~$0.75; 1 to 2 tries -> $0.35 to $1.10 |
| Interpolate (RIFE) | local GPU, $0                       | $0 (local)                                              |
| Encode (ffmpeg)    | local, $0                           | $0 (local)                                              |

**Per-video totals (estimate):**

- **Free / manual tier:** ~$0, capped by free daily credits (a few clips a day)
  and your clicking time.
- **Cheap-API tier (Flux + Kling):** roughly **$0.60 to $1.00** per finished video,
  fully automatable.
- **Premium-API tier (FLUX.2 [pro] + Runway Gen-4 + retries):** roughly **$1.20 to
  $2.00+**, best fidelity.

**At volume (cheap tier, ~$1/video):** 1/day ≈ $30/month; 5/day ≈ $150/month for
~150 videos. Subscription plans (Runway / Kling ~$12 to $95/month with credit
pools) can undercut per-second pricing if you batch, but per-second API is cleaner
for unattended automation.

Section 2 replaces these estimates with measured numbers from real runs. The
constraint is never the dollar cost of a clip. It is whether that clip can be
turned into more than a dollar.

## 2. Field study: what runs actually cost (mid-2026)

Section 1 reasons from published price lists. This section reports what actually
happened across the first batch of finished runs, so anyone weighing this pipeline
can plan against measured numbers rather than vendor estimates. It is written as a
study, not a pitch: the costs are real, the savings are real, and the limits are
stated.

### 2.1 What one finished video really cost

Six finished, AI-labelled portrait videos (one recurring style, distinct concepts
per run) were produced end to end. Every run logs a per-stage cost ledger; the
table is those ledgers, not projections.

| Run     | Image stage              | Animate stage (the cost driver)          | Local stages | **Finished total** |
| ------- | ------------------------ | ---------------------------------------- | ------------ | ------------------ |
| 74dd    | Flux dev (Fal) $0.06     | Cosmos-3-super (Fal) $0.40               | $0           | **$0.46**          |
| ce9e    | Flux dev (WaveSpeed) $0.03 | Kling 1.6 standard (WaveSpeed) $0.50    | $0           | **$0.53**          |
| d217    | Flux dev (Fal) $0.06     | Kling 3 turbo pro (Fal) $0.70            | $0           | **$0.76**          |
| b878    | Nano Banana (Gemini) $0.04 | Veo 3.1 $1.20                           | $0           | **$1.24**          |
| 1f14    | Gemini flash image $0.04 | Veo 3.1 $1.20                            | $0           | **$1.24**          |
| 2a5a    | Flux dev (Fal) $0.06     | Seedance 2.0 (Fal) $1.52                 | $0           | **$1.58**          |

**What the measured sample confirms:**

- **Median finished cost ≈ $1.00; cheapest fully-eligible video $0.46.** The
  section 1 estimate ($0.60 to $1.00 cheap-API, $1.20 to $2.00+ premium) held up
  against real runs. Nothing in the batch exceeded $1.58.
- **Animation is effectively the entire bill: 87% to 96% of every run.** Image
  generation was $0.03 to $0.06 flat. Optimising anything other than the animate
  stage is rounding error.
- **The director LLM was $0 in practice.** Concept, revision, finalisation, and
  caption (Claude Sonnet 4.6, with prompt caching on the system message) landed at
  $0 across all runs on the free/cached tier, below even the ~$0.01 to $0.05
  estimate. Treat director spend as zero until volume changes that.

### 2.2 Provider and model cost, measured

Same image, different animator, is a 4x cost swing. The animate model is the one
decision that moves the unit economics.

| Animate model        | Observed price | Notes                                                        |
| -------------------- | -------------- | ----------------------------------------------------------- |
| Cosmos-3-super (Fal) | **$0.40**      | Cheapest animator in the batch; best cost-per-clip          |
| Kling 1.6 standard   | $0.50          | WaveSpeed pricing; solid baseline motion                    |
| Kling 3 turbo pro    | $0.70          | Stronger, complex motion for a modest premium               |
| Veo 3.1              | $1.20          | Cinematic consistency; ~3x the cheapest option              |
| Seedance 2.0         | **$1.52**      | Most expensive; reserve for when the concept demands it      |

Image stage, by contrast, barely registers: Flux dev ran $0.03 (WaveSpeed) to
$0.06 (Fal), Gemini/Nano Banana $0.04. Picking the "expensive" image model costs
three cents. Picking the expensive animator costs a dollar.

**Practical rule:** default the animator to the cheapest model that clears the
quality bar (Cosmos-3-super or Kling standard, ~$0.40 to $0.50), and spend up to
Veo/Seedance only on concepts you have reason to believe will carry their weight.
The pipeline's per-stage provider selection exists precisely so this knob is
per-run, not global.

### 2.3 What the local tools save (the real lever)

Three stages run locally and cost nothing per run: the director LLM, RIFE
interpolation, and the ffmpeg export. RIFE is where the leverage is, in two ways.

**Free fluidity.** Sources arrived at 5 to 8 seconds, 24 to 30 fps. RIFE
(`rife-ncnn-vulkan`, Apple GPU via MoltenVK) interpolates every run to a 120 fps
ProRes 422 HQ master locally, for $0. A paid interpolation API would add cost to
the single most-run stage; here it is absorbed by the M1 Max.

**Free duration: the half-speed trick.** This is the saving worth designing
around. Because RIFE manufactures real in-between frames (not duplicated frames), a
120 fps master can be played back at the 60 fps delivery cap at **half speed** and
still show unique, smooth frames the whole way. The arithmetic is exact: an **8 s**
source generated at 24 fps becomes 120 fps after interpolation, which is **16 s of
genuine 60 fps footage** at half speed. The slow-motion looks deliberate and
clean, not juddery, because every frame is real.

The point: you reach a **full 16-second clip without generating 16 seconds.** The
animate stage is billed by the second, so duration is the expensive axis. Doubling
runtime in post, for free, roughly halves cost-per-delivered-second:

| Path to 16 s of delivered footage | Animate cost | Cost per delivered second |
| --------------------------------- | ------------ | ------------------------- |
| Veo 3.1, generate 8 s, half-speed to 16 s | **$1.20** | **$0.075** |
| Veo 3.1, generate 16 s natively (est.)    | ~$2.40       | ~$0.15                    |
| Cosmos-3-super, 8 s, half-speed to 16 s   | **$0.40**    | **$0.025**                |
| Cosmos-3-super, 16 s natively (est.)      | ~$0.80+      | ~$0.05+                   |

A slow forward camera push (the studio's house motion) is the ideal candidate for
this: it reads as intentional, premium slow motion, and the longer dwell time suits
the contemplative, scroll-stopping clips the concept targets. The trade-off is real
and bounded: half speed only suits motion that is meant to be slow, and the 120 fps
ProRes master is ~280 to 540 MB per clip, which is why external SSD storage is a
hard requirement (see [03-constraints-and-cost.md](03-constraints-and-cost.md)).

### 2.4 The cost picture, settled

Production cost is a solved, small problem: **~$0.46 to $1.58 per finished,
AI-labelled, original video**, dominated entirely by the animator, with the
director, interpolation, half-speed duration, and export all free. A month of one
video a day costs roughly $15 to $30 in API spend.

The cost question is therefore not the constraint on a business built on this
pipeline. The constraint is converting these cheap clips into revenue, which is a
different and much harder problem. The rest of this document studies that problem.

## 3. Social media economics (the unsettled half)

Everything above is settled and cheap. Earning from the output is neither. Every
target platform moved the same direction in 2025 to 2026: **against** faceless,
fully-AI, mass-produced short-form for *view-based* payouts. This section is
deliberately compact: the detail matters less than the conclusion, which is that
per-view ad funds cannot pay for this and the real money sits elsewhere.

### 3.1 Platform payouts at a glance

| Platform            | View-based pay                                  | AI catch                                                      |
| ------------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| **TikTok** (Creator Rewards) | ~$0.40 to $1.00+ / 1,000 qualified views, but needs 10k followers, 100k views/30d, and **>= 60 s** original video | Leans toward **excluding fully AI-generated video**; AI as a *tool* only, must carry the AI label |
| **Instagram**       | **No broad pay-per-view.** Money is brand, Gifts (Stars), Subscriptions, invite-only Bonuses | AI Reels can earn **if labelled**; the 2026 unoriginal-content crackdown cuts reach and can pull monetization **account-wide** for templated posting |
| **YouTube Shorts**  | Shorts ad pool, **~$0.01 to $0.07 / 1,000** (tiny); needs 1,000 subs + 10M Shorts views/90d | **The harshest:** the 15 Jul 2025 inauthentic-content policy demonetizes mass-produced AI, enforced **channel-wide** |

Two consequences fall straight out:

1. **Per-view payouts cannot fund this.** At ~$1/video and YouTube's ~$0.05/1,000,
   a video needs **~20,000 views just to break even** on YouTube native pay; TikTok
   Creator Rewards is likely **$0** for fully-AI video; Instagram pays **$0** per
   view. The view economy barely covers production at best, and is mostly closed to
   us.
2. **Variety is compliance, not just craft.** Genuinely varied output (different
   worlds, concepts, looks) is exactly what the "inauthentic / templated" rules
   reward. The three-gate, human-in-the-loop design with per-run distinct concepts
   is a real defence: curated, varied, human-approved work, not a template farm.

### 3.2 Where the money actually is

The positioning is **human-directed digital art**: AI is the tool, the concept and
art direction are human. Design monetization **around** the platform payouts, not
on top of them:

1. **Brand partnerships / sponsorships:** the largest creator revenue on TikTok and
   Instagram, open to labelled AI content when the audience is real.
2. **Affiliate / TikTok Shop:** sell or affiliate products in-video; independent of
   Creator Rewards.
3. **Owned funnel:** the shorts are top-of-funnel for something you own (a store,
   digital products, a newsletter, a membership). This is where AI volume becomes an
   asset, not a liability.
4. **Sell the art itself:** licence the clips as stock or motion backgrounds, sell
   loops and wallpapers, take commissions, or run a collectible drop.
5. **Sell the capability:** the pipeline itself as a service or product.
6. **Gifts / subscriptions:** minor but real once an audience exists.

**Recommended platform roles:** TikTok + Instagram primary (reach plus the surface
for brand/affiliate revenue, always AI-labelled); YouTube Shorts a secondary reach
channel only, with negligible native RPM and the strictest AI policy, so treat any
payout there as a bonus.

### 3.3 What this means for a monetization run

- **Spend follows the revenue door, not the view count.** Cheap animator for the
  bulk feed (reach and consistency); premium animator reserved for the few clips
  carrying a brand placement, affiliate link, or owned-funnel call to action.
- **The half-speed 16 s path helps watch-time, not the 60 s wall.** A longer asset
  from one cheap generation suits TikTok and Reels completion signals and gives the
  B-roll path more to intercut without a second paid clip. It does **not** clear
  TikTok's 60 s Creator Rewards minimum, and should not be used to fake one: that
  fund is closed to fully-AI video anyway. Do **not** stitch 12 to 15 clips into a
  pure-AI minute ($15 to $30, demonetization risk); the opt-in B-roll path (2 to 3
  clips intercut with human A-roll, ~$3) clears the wall and the originality bar at
  once. The studio exports an editor project for this; it does not build an editor.
- **Compliance is intrinsic, and free.** Distinct concepts per run, human approval
  at each gate, and mandatory AI labelling are what keep the output on the right
  side of the rules. Templating to "save" director effort saves $0 (the director is
  already free) and forfeits eligibility. AI labelling is a pipeline requirement set
  at the publish stage, not an afterthought (folded into phase 2 of
  [05-scope-and-phases.md](05-scope-and-phases.md)).
- **Track revenue, not just views.** Phase 3 analytics should attribute earnings to
  concepts and styles, so the studio optimises for what pays (a brand click, a shop
  sale), not vanity reach.

**Bottom line:** the pipeline makes a finished, platform-eligible, 16-second video
for about a dollar, and the local tools (free interpolation, free half-speed
duration, free director) hold it there. That cost floor is not the constraint. The
constraint is converting cheap clips into brand, affiliate, or owned-funnel
revenue, because the platforms have closed the per-view door to this content.

## Sources

- TikTok Creator Rewards and AI rules: [Multilogin](https://multilogin.com/blog/mobile/tiktok-creator-rewards-program/),
  [TikTok eligibility guidelines](https://www.tiktok.com/discover/creator-rewards-program-eligibility-requirements-guidelines),
  [Scribe: AI content on TikTok](https://scribehow.com/page/Can_You_Make_Money_on_TikTok_with_AI-Generated_Content__KxkcveXCT9C69oqKRvVb4Q),
  [Storrito: AI monetization limits](https://storrito.com/resources/what-tiktoks-ai-monetization-restrictions-signal-for-creator-income/).
- YouTube Shorts and the inauthentic-content policy: [vidIQ](https://vidiq.com/blog/post/youtube-shorts-monetization/),
  [Fliki: July 2025 policy](https://fliki.ai/blog/youtube-monetization-policy-2025),
  [SubSub: inauthentic content](https://www.subsub.io/blog/youtube-inauthentic-content-policy-2025),
  [YouTube Shorts policies (official)](https://support.google.com/youtube/answer/12504220).
- Instagram: [Printify: get paid for Reels](https://printify.com/blog/how-to-get-paid-for-reels/),
  [ALM: Meta original-content rules 2026](https://almcorp.com/blog/meta-original-content-rules-2026-facebook-instagram-creators/).
- Pricing: [AI video API costs (buildmvpfast)](https://www.buildmvpfast.com/api-costs/ai-video),
  [Kling pricing (eesel)](https://www.eesel.ai/blog/kling-ai-pricing),
  [Flux pricing (costbench)](https://costbench.com/software/ai-image-generators/flux/).
</content>
</invoke>
