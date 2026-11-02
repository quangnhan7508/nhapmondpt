---
name: awesome-design-md
description: "Curated collection of 80+ production DESIGN.md specifications extracted from real websites (PlayStation, Linear, Stripe, Supabase, Vercel, Nike, Nintendo, 1win, PostHog, etc.). Use this skill when the user wants to mimic or reference the exact design tokens, typography scales, color schemes, and component styling of a specific real-world brand or website."
---

# Awesome DESIGN.md

A curated collection of production design systems following the Google Stitch `DESIGN.md` specification.

## When to Use This Skill

- When the user asks to adopt the visual identity of a specific brand (e.g. "style this like Linear", "give it a PlayStation gaming look", "use Vercel clean monochrome design", "Nintendo vintage aesthetic").
- When you need exact production color tokens, font hierarchies, component rules, and responsive behavior extracted from leading web products.

## Available Design Systems

All design specifications are located in `./design-md/<brand>/DESIGN.md`.

### Gaming & Entertainment
- **PlayStation** (`./design-md/playstation/DESIGN.md`): Three-surface channel layout (black, white, PlayStation blue `#0070d1`), airy light display typography, cyan hover-scale interactions, dark-mode gaming feel.
- **Nintendo (2001 Y2K)** (`./design-md/nintendo-2001/DESIGN.md`): Y2K console chrome, brushed-periwinkle beveled panels, glowing amber halftone nav, pixel retro game aesthetic.
- **1win** (`./design-md/1win/DESIGN.md`): Near-black canvas, vivid green accent, dense game-tile rails, card/board game lobby format.
- **Spotify** (`./design-md/spotify/DESIGN.md`): Vibrant green on dark, bold type, album/card art-driven.

### Developer & Modern Dark Tech
- **Linear** (`./design-md/linear.app/DESIGN.md`): Ultra-minimal, precision UI, signature purple accents, keyboard-first feel.
- **Supabase** (`./design-md/supabase/DESIGN.md`): Dark emerald theme, technical code-first aesthetic.
- **Vercel** (`./design-md/vercel/DESIGN.md`): Precision black and white monochrome, Geist font, clean lines.
- **Raycast** (`./design-md/raycast/DESIGN.md`): Sleek dark chrome, vibrant gradient accents.
- **PostHog** (`./design-md/posthog/DESIGN.md`): Playful developer-friendly dark UI.

### Fintech & Clean Minimal
- **Stripe** (`./design-md/stripe/DESIGN.md`): Signature purple gradients, weight-300 elegance, high-trust finance.
- **Revolut** (`./design-md/revolut/DESIGN.md`): Sleek dark interface, gradient cards, fintech precision.

## How to Apply a DESIGN.md

1. Read the target brand's file at `design-md/<brand>/DESIGN.md`.
2. Extract the semantic CSS variables (`colors`, `typography`, `component stylings`, and `elevation`).
3. Inject the tokens into your project's `index.css`, Tailwind config, or CSS variables.
4. Adhere to the "Do's and Don'ts" and "Agent Prompt Guide" listed at the bottom of the target `DESIGN.md`.
