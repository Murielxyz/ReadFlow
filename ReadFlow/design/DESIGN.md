---
name: Neo-Graphite Reading
colors:
  surface: '#fcf9f8'
  surface-dim: '#dcd9d9'
  surface-bright: '#fcf9f8'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3f2'
  surface-container: '#f0eded'
  surface-container-high: '#eae7e7'
  surface-container-highest: '#e5e2e1'
  on-surface: '#1b1b1c'
  on-surface-variant: '#47464d'
  inverse-surface: '#303030'
  inverse-on-surface: '#f3f0ef'
  outline: '#77767e'
  outline-variant: '#c8c5ce'
  surface-tint: '#5c5c77'
  primary: '#5c5c77'
  on-primary: '#ffffff'
  primary-container: '#dfdefe'
  on-primary-container: '#61617c'
  inverse-primary: '#c4c4e3'
  secondary: '#745b0c'
  on-secondary: '#ffffff'
  secondary-container: '#ffdc84'
  on-secondary-container: '#795f11'
  tertiary: '#5a6059'
  on-tertiary: '#ffffff'
  tertiary-container: '#dde3d9'
  on-tertiary-container: '#5f655e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c4c4e3'
  on-primary-fixed: '#181931'
  on-primary-fixed-variant: '#44455e'
  secondary-fixed: '#ffdf91'
  secondary-fixed-dim: '#e4c36d'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#594400'
  tertiary-fixed: '#dee4db'
  tertiary-fixed-dim: '#c2c8bf'
  on-tertiary-fixed: '#171d17'
  on-tertiary-fixed-variant: '#424841'
  background: '#fcf9f8'
  on-background: '#1b1b1c'
  surface-variant: '#e5e2e1'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 30px
    fontWeight: '800'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.125rem
    fontWeight: '700'
    lineHeight: '1.5'
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 1rem
    fontWeight: '700'
    lineHeight: '1.5'
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.75rem
    fontWeight: '700'
    lineHeight: '1'
  label-xs:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '700'
    lineHeight: '1'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  xs: 4px
  sm: 12px
  base: 8px
  md: 24px
  lg: 40px
  xl: 64px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
  max-width: 1200px
---

## Brand & Style
The "Neo-Graphite Reading" style is a playful yet structured fusion of **Neo-Brutalism** and **Modern Minimalism**. It evokes the feeling of a physical notebook or a tactile collector's item. The brand personality is intellectual, organized, and energetic—perfect for a power-user book tracking and reading application.

Key characteristics include:
- **Hard Shadows & High Contrast**: Every card and primary action button uses a "hard" 4px offset shadow with no blur, grounded by heavy 2px borders.
- **Eclectic Accents**: A core palette of vibrant, desaturated pastels (Lavender, Gold, Sage) distinguishes functional areas while maintaining a cohesive, slightly retro feel.
- **Interactive Tactility**: Elements use a "press" effect (transform translate) rather than standard opacity fades, simulating physical interaction.

## Colors
The palette is built on a "Paper & Ink" foundation. The background is a warm, off-white cream (`#FAF7F2`) to reduce eye strain, while the primary ink color is a deep charcoal (`#1F1F1F`).

- **Functional Accents**: Soft Lavender (`#DFDEFE`) denotes reading progress and primary CTAs. Gold (`#FEDB82`) and Sage Green (`#F0F6EC`) are used for secondary actions like timers or note-taking.
- **Tonal Layers**: The UI uses subtle shifts between the paper background and pure white surfaces for cards. 
- **Light Accents**: The palette has shifted toward a higher-key, more airy "fidelity" variant, using lighter, more desaturated versions of the core hues to maintain hierarchy without overwhelming the text.

## Typography
The system relies exclusively on **Plus Jakarta Sans** for its modern, friendly, and geometric proportions. 

- **Weight as Hierarchy**: Heavy weights (ExtraBold/800) are reserved for book titles and major sections to emphasize the Neo-Brutalist structure.
- **Meta-Data**: Small uppercase labels (`label-xs`) are used for overlines and category headers to provide a clear technical feel.
- **Reading Comfort**: Body text uses a generous line height for maximum legibility against the cream background.

## Layout & Spacing
The layout uses a **Responsive Fixed Grid** model with a maximum content width of 1200px.

- **Mobile Rhythm**: 16px side margins with vertical sections stacked using 24px-40px gaps.
- **Desktop Rhythm**: 48px side margins with a multi-column layout for action buttons and stats grids.
- **Gutters**: A consistent 24px gutter is used between grid items (Action buttons, Stats, Source cards).
- **Sectioning**: Content is grouped into distinct `<section>` blocks with ample vertical padding (`py-lg`) to prevent visual clutter.

## Elevation & Depth
Depth in this system is **structural**, not atmospheric. 

- **Borders**: Everything is contained. The primary boundary is a 2px solid `#1F1F1F` border. 
- **Hard Shadows**: Instead of soft blurs, use a solid color shadow (`#1F1F1F`) at a `4px 4px` offset. This applies to cards, main buttons, and image containers.
- **Active State**: Interactive elements should "sink" on press by removing the shadow and translating the element `2px` down and `2px` right.
- **Dividers**: Use subtle `2px` solid borders for separators (e.g., bottom of the app bar or between list items) to maintain the "ink on paper" aesthetic.

## Shapes
The shape language is "Soft-Square." 
- **Base Components**: Buttons and small cards use a 0.5rem (8px) radius.
- **Feature Cards**: Larger containers like the book cover, action cards, and feed containers use a 1rem (16px) radius to feel more approachable.
- **Interactive Roundness**: Use fully rounded (pill-shaped) borders for tags and search-style inputs to provide contrast against the predominantly rectangular layout.

## Components
- **Neo-Buttons**: Must have a `modern-border` (2px solid ink) and a `hard-shadow`. Primary buttons use high-saturation backgrounds with white text.
- **Chips & Tags**: Pill-shaped with a 2px border and light grey or cream backgrounds. Text must be bold and small.
- **Action Cards**: Combine an icon in a circle (30% opacity of the parent color) with a two-line text hierarchy and a status indicator.
- **Reading Progress**: Linear progress bars should be simplified, using a high-contrast white bar on a desaturated track.
- **Timeline Feed**: Use a vertical 2px line with circular nodes. Nodes should be color-coded based on the event type (Lavender for ideas, Gold for additions, Sage for time).
- **Navigation**: The mobile bottom bar is a sticky white surface with a 2px top border, using filled icons for the active state and outlined icons for inactive states.