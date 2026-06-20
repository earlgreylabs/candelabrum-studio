# Economics and monetization

This is a viability document. It answers two questions honestly: **what does one
finished video cost to produce**, and **how could this actually earn**, given that
all three target platforms spent 2025 to 2026 tightening the rules against exactly
this kind of content.

Headline finding, up front: **platform view-based payouts are small and
increasingly closed to fully AI-generated content. Framed as human-directed digital
art (AI is the tool; the concept and art direction are human), the work stays
eligible and gains revenue doors a content-farm lacks: the realistic money is brand,
affiliate, an owned funnel, and selling the art itself, not per-view ad funds.
Making videos is cheap; making money from them is the hard part.**

(Figures are mid-2026 orders of magnitude and move often; sources at the end.)

## 1. Production cost per video

One finished video is one base image plus one short image-to-video clip,
interpolated and encoded locally. The local steps are free, so cost is dominated
by the two cloud generations plus a small director-LLM spend.

| Stage              | Free / manual route                 | Paid-API route (per video)                              |
| ------------------ | ----------------------------------- | ------------------------------------------------------- |
| Direct (LLM)       | Gemini free tier                    | ~$0.01 to $0.05                                         |
| Image (Flux 1.1)   | web tier (Tensor.art, SeaArt), $0   | ~$0.04 each; ~$0.04 to $0.16 with retries               |
| Animate (~5 s)     | Luma / Kling free credits, $0       | Kling ~$0.10/s -> ~$0.50; Runway ~$0.15/s -> ~$0.75; 1 to 2 tries -> $0.50 to $1.50 |
| Interpolate (RIFE) | local GPU, $0                       | $0 (local)                                              |
| Encode (ffmpeg)    | local, $0                           | $0 (local)                                              |

**Per-video totals:**

- **Free / manual tier:** ~$0, capped by free daily credits (a few clips a day)
  and your clicking time.
- **Cheap-API tier (Flux + Kling):** roughly **$0.60 to $1.00** per finished video,
  fully automatable.
- **Premium-API tier (Flux ultra + Runway Gen-4.5 + retries):** roughly **$1.20 to
  $2.00+**, best fidelity.

**At volume (cheap tier, ~$1/video):** 1/day ≈ $30/month; 5/day ≈ $150/month for
~150 videos. Subscription plans (Runway / Kling ~$12 to $95/month with credit
pools) can undercut per-second pricing if you batch, but per-second API is cleaner
for unattended automation.

The constraint is never the dollar cost of a clip. It is whether that clip can be
turned into more than a dollar.

**The 60-second trap.** TikTok's Creator Rewards needs >= 60 s, which tempts
stitching 12 to 15 clips into one video: that is $15 to $30 of generation plus a
demonetization risk, and it wrecks the unit economics. The studio refuses that
pattern. The opt-in **B-roll** path instead produces 2 to 3 high-impact clips
(~$3) to intercut with cheap, human-led A-roll, which clears the length wall, keeps
costs sane, and reads as original human-led content.

## 2. Platform monetization (mid-2026)

> **The 60-second minimum is narrow.** It applies only to TikTok's Creator Rewards
> fund. Sub-60s content monetises fine everywhere else: brand deals, affiliate and
> social commerce (TikTok Shop, YouTube Shopping), gifts, memberships, and the
> funnel, plus YouTube's length-agnostic Shorts ad pool. Length was never the real
> lever; an audience plus something to sell is.

### TikTok: Creator Rewards Program

- **Eligibility:** 18+, **10,000 followers**, **100,000 views in the last 30
  days**, account > 30 days, 2FA on, supported country, no strikes.
- **Video rules:** must be **>= 60 seconds** and **original**.
- **Payout:** ~**$0.20 to $2.50 per 1,000** qualified views; most report **$0.40 to
  $1.00+**, niche-dependent. Paid the 15th of the next month, $50 minimum.
- **AI catch:** TikTok leans toward **excluding fully AI-generated video** from
  Creator Rewards. AI as a *tool* (captions, colour, B-roll) keeps eligibility; AI
  as the *producer* of the whole video does not. Realistic AI content must carry
  the AI label; repeated failure escalates to removal from the program.

### Instagram: no broad pay-per-view

- Instagram **does not pay for Reels views** outside invite-only bonus windows. The
  money is **brand partnerships**, **Gifts** (Stars; from 500 followers, $25
  minimum payout), **Subscriptions**, **Live Badges**, and **invite-only Bonuses**
  for high performers.
- **Eligibility:** professional (Creator / Business) account, ~1,000 followers,
  18+, original content.
- "Ad revenue" figures of ~$0.01 to $0.05 per 1,000 apply only inside bonus
  programs.
- **AI catch:** AI Reels **are** eligible to earn (brand / affiliate / products)
  **if labelled**, but the 2026 "unoriginal content" crackdown cuts reach and can
  remove monetization eligibility **account-wide** for templated, duplicative
  posting.

### YouTube Shorts: Partner Program

- **Eligibility:** **1,000 subscribers + 10,000,000 valid Shorts views in 90 days**
  (or 1,000 subs + 4,000 long-form watch hours).
- **Payout:** Shorts ad pool; YouTube keeps 55%, creators split **45%** by share of
  monetized views. RPM is **tiny: ~$0.01 to $0.07 per 1,000** (~$0.03 to $0.10 in
  strong niches).
- **AI catch (the harshest):** the **15 July 2025 "inauthentic content" policy**
  demonetizes **mass-produced, repetitive, templated, easily-replicable** content,
  especially AI narration without human insight, and enforces **channel-wide** (one
  bad batch can demonetize or remove the whole channel). This is the single biggest
  threat to a faceless AI-shorts factory.

## 3. The AI-content reality (the part that decides the project)

Every target platform moved the same direction in 2025 to 2026: **against**
faceless, fully-AI, mass-produced short-form for *view-based* payouts.

- **YouTube:** inauthentic-content policy, channel-wide demonetization risk.
  Hardest for pure AI.
- **TikTok:** Creator Rewards excludes fully AI-generated video; AI-as-tool only.
- **Instagram:** no broad view payout anyway, plus unoriginal-content reach and
  monetization penalties.

Two consequences fall straight out:

1. **Per-view payouts cannot fund this on their own.** At cheap-tier ~$1/video and
   YouTube's ~$0.05/1,000, a video needs **~20,000 views just to break even** on
   YouTube native pay; TikTok Creator Rewards is likely **$0** for fully-AI video;
   Instagram pays **$0** per view. The view economy barely covers production at
   best, and is mostly closed to us.
2. **Variety is compliance, not just craft.** The brief to keep content genuinely
   varied (different worlds, concepts, looks) is exactly what the "inauthentic /
   templated / mass-produced" rules reward. The two-gate, human-in-the-loop design
   and per-run distinct concepts are a real defence: this is curated, varied,
   human-approved output, not a template farm. Lean into that.

## 4. Where the money actually is

The positioning is **human-directed digital art**: AI is the tool, the concept and
art direction are human. That is both an eligibility shield (original and
transformative, not mass-produced) and a set of revenue doors a faceless
content-farm does not have. Design monetization **around** the platform payouts,
not on top of them:

1. **Brand partnerships / sponsorships**: the largest creator revenue on TikTok
   and Instagram, open to AI content when labelled and the audience is real. Needs
   a following first.
2. **Affiliate / TikTok Shop**: sell or affiliate products in-video; independent
   of Creator Rewards; works with AI content.
3. **Owned funnel**: the shorts are top-of-funnel for something you own: a store,
   digital products (wallpapers, prompt packs, the looks themselves), a newsletter,
   a membership. This is where AI volume becomes an asset, not a liability.
4. **Sell the capability**: the pipeline itself as a service or product under Earl
   Grey Labs.
5. **Gifts / subscriptions**: minor but real on Instagram and TikTok Live once an
   audience exists.
6. **Sell the art itself**: the clips are digital art. Licence them as stock or
   motion backgrounds, sell loops and wallpapers, take commissions, or run a
   collectible drop. The output is a product, not only an ad.

**Recommended platform roles:**

- **TikTok + Instagram:** primary, for reach and as the surface for brand /
  affiliate revenue. Always AI-labelled.
- **YouTube Shorts:** secondary reach channel only. Native RPM is negligible and
  its AI policy is the strictest, so treat any payout as a bonus and respect the
  channel-wide demonetization risk. It clears the "only if it delivers" bar **for
  reach**, not for meaningful native pay.

## 5. What this means for the build

- **AI labelling is a pipeline requirement**, not an afterthought: the publish
  stage must set each platform's AI-content label (folded into phase 2 of
  [05-scope-and-phases.md](05-scope-and-phases.md)).
- **Originality by design:** keep concepts genuinely distinct run to run; the
  metadata cache should help detect and avoid templated sameness, not only chase a
  winning template.
- **The 60-second wall, resolved:** do not stitch 12 to 15 clips into a pure-AI
  minute ($15 to $30, demonetization risk). The opt-in B-roll path (2 to 3 clips
  intercut with human A-roll, ~$3) clears the wall and the originality bar at once.
  The studio exports an editor project for this; it does not build an editor.
- **Track revenue, not just views:** phase 3 analytics should attribute earnings to
  concepts and styles, so the studio optimises for what pays (a brand click, a shop
  sale), not vanity reach.

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
