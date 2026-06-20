---
# Design tokens (machine-readable). Reconciled from docs/concept/ by /sync-protocols,
# and hand-editable. Delete this file if the project has no UI.
name: Candelabrum Studio
mode: dark
colors:
  background: "#0C0C0E"        # app base: near-black, faintly neutral
  surface: "#15151A"           # panels, cards, sidebar
  surfaceRaised: "#1C1C22"     # modals, popovers, menus
  border: "#2A2A31"            # hairlines, dividers
  primary: "#ECEAE6"           # primary text / headers (warm off-white on dark)
  secondary: "#9A968E"         # metadata, labels, subdued elements
  faint: "#6B6862"             # timestamps, disabled
  accent: "#E3A93C"            # candle gold: primary action, links, focus
  accentHover: "#F0C063"
  accentActive: "#C2882B"
  accentForeground: "#1A1505"  # text/icon on a gold fill
  status:
    rendering: "#5AB0C9"       # generating (cool nebula cyan)
    ready: "#5BA66E"           # approved / ready
    warning: "#E07B39"         # storage gauge >= 80%
    danger: "#C4452E"          # reject / trash, storage gauge >= 90%
typography:
  fontFamily: "Inter, sans-serif"
  monoFamily: "JetBrains Mono, monospace"
  baseSize: "14px"
---

# DESIGN.md

The visual identity contract: design tokens (the frontmatter above) plus the
rationale below. Agents must use these tokens and never invent new ones. For a
project with no UI, delete this file.

<!-- BEGIN PROJECT SPECIFICS: reconciled from docs/concept/ by /sync-protocols,
and hand-editable. -->

## Overview

Candelabrum Studio's operator dashboard is a **dark, functional, single pane of
glass**. The operator stares at it for long review sittings, so it is near-black
by default and restrained on purpose: the content (highly saturated, ever-varying
fantasy / sci-fi clips) is the focal point, and the chrome must recede so a clip
of any aesthetic reads clearly against it. The lineage is Scandinavian / Swiss
functionalism: clarity, generous whitespace, confident typography, flat honest
surfaces, craft in the details. The single warm **candle-gold** accent is borrowed
from the studio logo's flames; the rest of the logo's nebula stays out of the UI so
the tool never competes with the work. Full interaction model and rationale:
[docs/concept/07-ui-ux.md](docs/concept/07-ui-ux.md).

## Colors

Dark theme, neutral near-black base, one gold accent.

- **Background / surface / surfaceRaised:** the three-step near-black elevation for
  app base, panels, and overlays. Flat: no heavy shadows or gradients.
- **primary / secondary / faint:** the text ramp (warm off-white to faint grey);
  primary for text and headers, secondary for metadata and labels.
- **accent (candle gold):** the one interactive colour: the primary action in a
  view, links, the active state, and a visible focus ring for the keyboard-first
  flow. Reserved for affordances, never decoration; secondary actions are neutral
  ghost buttons.
- **status (rendering / ready / warning / danger):** kept distinct from the gold
  accent, which means "action," not "state." `warning` and `danger` also drive the
  storage gauge (>= 80% orange, >= 90% red).

## Typography

- **Inter** (variable) for all functional UI, base 14 px, generous line-height and
  spacing.
- **JetBrains Mono** for technical fields (seeds, costs, run ids, timestamps).
- The ornate logo wordmark is never used as a UI typeface.

## Components

shadcn/ui primitives (Tailwind CSS v4) themed to the tokens above: 1 px borders, a
single radius scale, flat surfaces, modest padding, and a gold focus ring on every
interactive element. One primary (gold) action per view; everything else neutral.

<!-- END PROJECT SPECIFICS -->
