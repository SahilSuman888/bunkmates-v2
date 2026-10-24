# BunkMates UI Design System

> **Design specification for BunkMates interfaces**
>
> This document defines the core visual language for BunkMates across light and dark modes. It is intended to keep web and app interfaces visually consistent while allowing individual components to adapt to their context.

---

## 1. Design Direction

BunkMates uses a minimal, highly rounded, translucent interface built around:

- Neutral monochrome surfaces
- Strong light/dark contrast
- Glass-like translucent cards
- Context-aware backdrop blur
- Soft internal reflections instead of borders
- No visible borders on UI components
- Large rounded corners
- Progressive blur for floating and overlay surfaces
- Minimal visual noise
- Clear hierarchy through spacing, typography, opacity, and scale

The interface should feel soft and layered without relying on excessive decoration.

---

## 2. Theme Colors

### 2.1 Main Background

| Mode | Color |
| --- | --- |
| Dark | `#000000` |
| Light | `#F1F1F1` |

```js
const mainBackground = mode === "dark"
  ? "#000000"
  : "#f1f1f1";
```

### 2.2 Card / Glass Surface

| Mode | Color |
| --- | --- |
| Dark | `rgba(20,20,20,0.08)` |
| Light | `rgba(255,255,255,0.39)` |

```js
const cardBackground = mode === "dark"
  ? "rgba(20,20,20,0.08)"
  : "rgba(255,255,255,0.39)";
```

These surfaces should generally be combined with backdrop blur and, where appropriate, internal reflections.

### 2.3 Primary CTA / Button

| Mode | Background | Recommended Text/Icon |
| --- | --- | --- |
| Dark | `#FFFFFF` | `#000000` |
| Light | `#000000` | `#FFFFFF` |

```js
const primaryButton = {
  backgroundColor: mode === "dark" ? "#ffffff" : "#000000",
  color: mode === "dark" ? "#000000" : "#ffffff",
};
```

The inverted foreground colors above are recommended to maintain strong contrast.

---

## 3. Border Radius

BunkMates components use generously rounded geometry.

### General Range

```css
border-radius: 24px /* through approximately 32px */;
```

The radius is contextual rather than fixed.

| Component | Suggested Radius |
| --- | --- |
| Chips / compact controls | `20px – 24px` |
| Standard buttons | `24px – 28px` |
| Inputs / compact surfaces | `24px – 28px` |
| Cards | `28px – 32px` |
| Large panels / dialogs | `30px – 36px` |
| Circular controls | `50%` |

These are guidelines rather than strict limits. Components may use slightly smaller or larger radii when their dimensions require it.

### Rule

The corner radius should remain proportional to component size. Avoid applying a large `32px` radius to very small controls when it causes distorted geometry.

---


## Border Policy

BunkMates intentionally **does not use borders** on UI components.

Visual separation is achieved through:

- Glass surfaces
- Internal reflections
- Backdrop blur
- Progressive blur
- Spacing
- Opacity
- Layering

```js
border: "none",
borderWidth: 0,
outline: "none", // except accessible keyboard focus indicators
```

Avoid decorative outlines around cards, buttons, chips, dialogs, inputs, navigation bars, and other surfaces. Reflections replace the need for borders throughout the design system.

---
## 4. Border Policy

**BunkMates does not use borders anywhere in the project UI.**

```js
border: "none",
```

Do not use `border`, `borderTop`, `borderBottom`, `borderLeft`, `borderRight`, `outline` as decoration, or translucent 1px border effects to define component surfaces.

Surface definition must come from:

- Internal reflections via `boxShadow`
- Background transparency
- Backdrop blur
- Spacing and layering
- Contrast between adjacent surfaces

Reflections replace decorative borders throughout the design system.

> Accessibility exception: interactive keyboard focus must still remain clearly visible. Prefer a non-border focus treatment such as an additional `boxShadow` layer or another clearly perceptible state that does not introduce a permanent component border.

---

## 6. Glass Surfaces

A standard glass surface combines transparency, backdrop blur, rounded corners, and reflection.

```jsx
<Box
  sx={{
    background:
      mode === "dark"
        ? "rgba(20,20,20,0.08)"
        : "rgba(255,255,255,0.39)",

    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",

    borderRadius: "30px",
    border: "none",
  }}
>
  {children}
</Box>
```

Blur intensity should be selected based on the component rather than globally fixed.

---

## 6. Backdrop Blur

### Range

```css
backdrop-filter: blur(10px);
```

through:

```css
backdrop-filter: blur(40px);
```

### Suggested Usage

| Component | Suggested Blur |
| --- | ---: |
| Small chip | `10px – 16px` |
| Button / compact floating control | `12px – 20px` |
| Card | `20px – 28px` |
| Navigation surface | `24px – 32px` |
| Dialog / modal | `28px – 40px` |
| Heavy overlay surface | `32px – 40px` |

Always include the WebKit version where browser compatibility is relevant:

```js
backdropFilter: "blur(20px)",
WebkitBackdropFilter: "blur(20px)",
```

Blur should support hierarchy. Increasing blur without a visual reason can make the interface unnecessarily heavy.

---

## 7. Component Reflections

BunkMates uses subtle inset highlights instead of strong conventional drop shadows.

Reflections are also the primary mechanism for visually defining component edges. Do not pair these reflections with borders.

There are two primary reflection styles.

---

### 6.1 Top + Bottom Reflection

**Preferred for larger or taller components**, including:

- Cards
- Dialogs
- Navigation panels
- Drawers
- Large floating surfaces
- Content containers

#### Dark Mode

```js
boxShadow:
  "inset 0 1px 1px rgba(255, 255, 255, 0.11), " +
  "inset 0 -1px 1px rgba(255, 255, 255, 0.07), " +
  "0 1px 0px rgba(0, 0, 0, 0.1)"
```

#### Light Mode

```js
boxShadow:
  "inset 0 1px 1px rgba(255, 255, 255, 0.8), " +
  "inset 0 -1px 1px rgba(0, 0, 0, 0.1), " +
  "0 1px 0px rgba(0, 0, 0, 0.1)"
```

#### MUI Implementation

```js
const largeComponentReflection =
  mode === "dark"
    ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), inset 0 -1px 1px rgba(255, 255, 255, 0.07), 0 1px 0px rgba(0,0,0,0.1)"
    : "inset 0 1px 1px rgba(255,255,255,0.8), inset 0 -1px 1px rgba(0,0,0,0.1), 0 1px 0px rgba(0,0,0,0.1)";
```

---

### 6.2 Top Reflection

**Preferred for smaller controls**, including:

- CTA buttons
- Standard buttons
- Chips
- Icon buttons
- Compact floating controls
- Small pills

#### Dark Mode

```js
boxShadow:
  "inset 0 1px 1px rgba(255, 255, 255, 0.11), " +
  "0 1px 0px rgba(0, 0, 0, 0.1)"
```

#### Light Mode

```js
boxShadow:
  "inset 0 1px 1px rgba(255, 255, 255, 0.8), " +
  "inset 0 -1px 1px rgba(0, 0, 0, 0.1)"
```

#### MUI Implementation

```js
const smallComponentReflection =
  mode === "dark"
    ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0,0,0,0.1)"
    : "inset 0 1px 1px rgba(255,255,255,0.8), inset 0 -1px 1px rgba(0,0,0,0.1)";
```

---

## 8. Progressive Blur

Progressive blur should be used when a floating component needs a soft visual transition into the content behind it.

Typical use cases include:

- Sticky headers
- Floating navigation
- Bottom navigation
- Floating toolbars
- Large overlays
- Top or bottom controls over scrolling content

### Reference Implementation

```jsx
<Box
  sx={{
    position: "absolute",
    top: -5,
    left: 0,
    right: 0,

    // Adjust according to the component and required fade distance.
    height: 200,

    zIndex: -1,
    mx: -2,
    pointerEvents: "none",

    backdropFilter: "blur(80px)",
    WebkitBackdropFilter: "blur(80px)",

    maskImage: `
      linear-gradient(
        to bottom,
        rgba(0,0,0,1) 0%,
        rgba(0,0,0,0.92) 18%,
        rgba(0,0,0,0.72) 38%,
        rgba(0,0,0,0.42) 62%,
        rgba(0,0,0,0.12) 82%,
        rgba(0,0,0,0) 100%
      )
    `,

    WebkitMaskImage: `
      linear-gradient(
        to bottom,
        rgba(0,0,0,1) 0%,
        rgba(0,0,0,0.92) 18%,
        rgba(0,0,0,0.72) 38%,
        rgba(0,0,0,0.42) 62%,
        rgba(0,0,0,0.12) 82%,
        rgba(0,0,0,0) 100%
      )
    `,

    background:
      mode === "dark"
        ? "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0))"
        : "linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0))",
  }}
/>
```

### Important

The `height: 200` value is **not a fixed design token**. It should change according to:

- Component height
- Scroll behavior
- Desired fade distance
- Position of the floating surface

The progressive blur layer should normally sit behind the actual component and should not capture pointer events.

---

## 9. Reverse Progressive Blur

For bottom-positioned components, reverse the mask direction.

```js
maskImage: `
  linear-gradient(
    to top,
    rgba(0,0,0,1) 0%,
    rgba(0,0,0,0.92) 18%,
    rgba(0,0,0,0.72) 38%,
    rgba(0,0,0,0.42) 62%,
    rgba(0,0,0,0.12) 82%,
    rgba(0,0,0,0) 100%
  )
`,
```

Use this for bottom navigation, bottom sheets, floating action areas, and controls anchored near the bottom of the viewport.

---

## 10. Buttons and CTAs

Primary actions should use the strongest monochrome contrast in the interface.

### Primary Button

```jsx
<Button
  sx={{
    px: 3,
    minHeight: 48,

    borderRadius: "26px",

    backgroundColor:
      mode === "dark"
        ? "#ffffff"
        : "#000000",

    color:
      mode === "dark"
        ? "#000000"
        : "#ffffff",

    boxShadow:
      mode === "dark"
        ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0,0,0,0.1)"
        : "inset 0 1px 1px rgba(255,255,255,0.8), inset 0 -1px 1px rgba(0,0,0,0.1)",

    textTransform: "none",
  }}
>
  Continue
</Button>
```

### Button Rules

Primary buttons should:

- Remain visually obvious against their surrounding surface.
- Use high-contrast foreground content.
- Use the compact/top reflection style.
- Keep icon and label alignment simple.
- Avoid excessive shadows.
- Avoid unnecessary gradients.
- Preserve generous horizontal padding.
- Use rounded geometry consistent with BunkMates.

---

## 11. Cards

Cards should provide separation through transparency, blur, reflection, and spacing. **Do not use borders.** Reflections are the project's edge-definition system.

```jsx
<Card
  sx={{
    p: 3,

    borderRadius: "32px",

    background:
      mode === "dark"
        ? "rgba(20,20,20,0.08)"
        : "rgba(255,255,255,0.39)",

    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",

    boxShadow:
      mode === "dark"
        ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), inset 0 -1px 1px rgba(255, 255, 255, 0.07), 0 1px 0px rgba(0,0,0,0.1)"
        : "inset 0 1px 1px rgba(255,255,255,0.8), inset 0 -1px 1px rgba(0,0,0,0.1), 0 1px 0px rgba(0,0,0,0.1)",
  }}
>
  {children}
</Card>
```

---

## 12. Chips

Chips should remain compact while following the same soft geometry.

```jsx
<Chip
  label="Upcoming"
  sx={{
    borderRadius: "24px",

    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",

    boxShadow:
      mode === "dark"
        ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0,0,0,0.1)"
        : "inset 0 1px 1px rgba(255,255,255,0.8), inset 0 -1px 1px rgba(0,0,0,0.1)",
  }}
/>
```

---

## 13. Dialogs and Large Floating Panels

Dialogs should use:

- Large radius
- High backdrop blur
- Top + bottom reflection
- Translucent card background
- Clear content spacing

```jsx
<Dialog
  PaperProps={{
    sx: {
      borderRadius: "32px",

      background:
        mode === "dark"
          ? "rgba(20,20,20,0.08)"
          : "rgba(255,255,255,0.39)",

      backdropFilter: "blur(40px)",
      WebkitBackdropFilter: "blur(40px)",

      boxShadow:
        mode === "dark"
          ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), inset 0 -1px 1px rgba(255, 255, 255, 0.07), 0 1px 0px rgba(0,0,0,0.1)"
          : "inset 0 1px 1px rgba(255,255,255,0.8), inset 0 -1px 1px rgba(0,0,0,0.1), 0 1px 0px rgba(0,0,0,0.1)",
    },
  }}
>
  {children}
</Dialog>
```

---

## 14. Navigation Surfaces

Floating navigation should visually belong to the same glass system.

Recommended properties:

```js
{
  borderRadius: "28px",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)"
}
```

Use progressive blur behind navigation when content scrolls beneath it.

Navigation itself should remain more defined than its surrounding progressive blur layer.

---

## 15. Layering Model

A typical BunkMates floating component can be thought of as four layers:

```text
Foreground
   │
   ├── Text / Icons / Controls
   │
   ├── Translucent Component Surface
   │
   ├── Inset Reflection
   │
   ├── Backdrop Blur
   │
   └── Optional Progressive Blur
   │
Background Content
```

Not every component needs all layers.

For example:

```text
Chip
→ Surface + small reflection + light blur

Card
→ Surface + large reflection + medium blur

Floating Navigation
→ Surface + large reflection + medium/high blur + progressive blur

Primary CTA
→ Solid CTA color + small reflection
```

---

## 16. Design Tokens

The following object can be used as a starting point for React/MUI implementations.

```js
export const getBunkMatesTokens = (mode) => ({
  colors: {
    background: {
      main: mode === "dark" ? "#000000" : "#f1f1f1",
      card:
        mode === "dark"
          ? "rgba(20,20,20,0.08)"
          : "rgba(255,255,255,0.39)",
    },

    action: {
      primary: mode === "dark" ? "#ffffff" : "#000000",
      onPrimary: mode === "dark" ? "#000000" : "#ffffff",
    },
  },

  radius: {
    chip: 24,
    button: 26,
    input: 26,
    card: 32,
    panel: 32,
  },

  blur: {
    small: "blur(12px)",
    medium: "blur(24px)",
    large: "blur(32px)",
    modal: "blur(40px)",
    progressive: "blur(80px)",
  },

  reflection: {
    large:
      mode === "dark"
        ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), inset 0 -1px 1px rgba(255, 255, 255, 0.07), 0 1px 0px rgba(0,0,0,0.1)"
        : "inset 0 1px 1px rgba(255,255,255,0.8), inset 0 -1px 1px rgba(0,0,0,0.1), 0 1px 0px rgba(0,0,0,0.1)",

    small:
      mode === "dark"
        ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0,0,0,0.1)"
        : "inset 0 1px 1px rgba(255,255,255,0.8), inset 0 -1px 1px rgba(0,0,0,0.1)",
  },
});
```

---

## 17. Reusable MUI Glass Utility

```js
export const getGlassSurface = (
  mode,
  {
    radius = 32,
    blur = 20,
    reflection = "large",
  } = {}
) => {
  const largeReflection =
    mode === "dark"
      ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), inset 0 -1px 1px rgba(255, 255, 255, 0.07), 0 1px 0px rgba(0,0,0,0.1)"
      : "inset 0 1px 1px rgba(255,255,255,0.8), inset 0 -1px 1px rgba(0,0,0,0.1), 0 1px 0px rgba(0,0,0,0.1)";

  const smallReflection =
    mode === "dark"
      ? "inset 0 1px 1px rgba(255, 255, 255, 0.11), 0 1px 0px rgba(0,0,0,0.1)"
      : "inset 0 1px 1px rgba(255,255,255,0.8), inset 0 -1px 1px rgba(0,0,0,0.1)";

  return {
    background:
      mode === "dark"
        ? "rgba(20,20,20,0.08)"
        : "rgba(255,255,255,0.39)",

    borderRadius: `${radius}px`,

    backdropFilter: `blur(${blur}px)`,
    WebkitBackdropFilter: `blur(${blur}px)`,

    boxShadow:
      reflection === "small"
        ? smallReflection
        : largeReflection,
  };
};
```

### Usage

```jsx
<Box
  sx={{
    ...getGlassSurface(mode, {
      radius: 32,
      blur: 28,
      reflection: "large",
    }),

    p: 3,
  }}
>
  Card Content
</Box>
```

---

## 18. Recommended Component Matrix

| Component | Surface | Radius | Blur | Reflection | Progressive Blur |
| --- | --- | ---: | ---: | --- | --- |
| Primary CTA | Solid | `24–28px` | None / low | Top | No |
| Secondary glass button | Glass | `24–28px` | `12–20px` | Top | No |
| Chip | Glass | `20–24px` | `10–16px` | Top | No |
| Input | Glass / neutral | `24–28px` | `12–20px` | Top | No |
| Standard card | Glass | `28–32px` | `20–28px` | Top + Bottom | No |
| Large card | Glass | `30–36px` | `24–32px` | Top + Bottom | Optional |
| Dialog | Glass | `30–36px` | `28–40px` | Top + Bottom | Optional |
| Floating header | Glass | `24–32px` | `24–32px` | Top + Bottom | Yes |
| Bottom navigation | Glass | `24–32px` | `24–32px` | Top + Bottom | Yes |
| Floating toolbar | Glass | `24–30px` | `20–30px` | Top + Bottom | Yes |

---

## 19. Interaction States

The visual system should remain restrained during interaction.

### Hover

Use small opacity, background, or transform changes rather than introducing unrelated colors.

```js
"&:hover": {
  transform: "translateY(-1px)",
}
```

### Active / Pressed

Pressed states may slightly reduce scale:

```js
"&:active": {
  transform: "scale(0.98)",
}
```

### Disabled

Disabled controls should reduce visual prominence while retaining readable content.

Avoid making disabled controls completely invisible.

### Focus

Interactive controls must retain a clearly visible keyboard focus state. The decorative reflection shadow should not be the only focus indicator.

---

## 20. Motion

Animations should reinforce the soft visual language.

Recommended transition range:

```css
150ms – 350ms
```

Typical UI transition:

```js
transition:
  "background-color 200ms ease, " +
  "box-shadow 200ms ease, " +
  "transform 200ms ease, " +
  "opacity 200ms ease";
```

Prefer subtle:

- Fade
- Scale
- Small vertical movement
- Blur transitions
- Surface opacity transitions

Avoid excessive bouncing or large movements for standard application controls.

Respect reduced-motion preferences for non-essential animation.

---

## 21. Accessibility and Readability

Glass effects must never reduce content readability.

When implementing a component:

1. Ensure text remains sufficiently distinct from its background.
2. Do not depend solely on transparency to establish hierarchy.
3. Keep primary CTAs strongly contrasted.
4. Provide visible keyboard focus indicators.
5. Ensure icons used without labels have accessible names.
6. Increase surface opacity when complex content behind a glass surface reduces readability.
7. Treat blur and reflection as decoration rather than information.

---

## 22. Performance Guidelines

Backdrop blur can be expensive when applied to many large surfaces.

Prefer:

```text
One intentional blurred parent surface
```

over:

```text
Many overlapping child elements each using backdrop-filter
```

Progressive blur should be reserved for areas where it materially improves the floating-layer effect.

Avoid unnecessarily applying `blur(40px)` or `blur(80px)` to full-screen regions.

---

## 23. Do / Don't

### Do

- Use reflections to define component edges instead of borders.
- Use the standard glass surface `rgba(20,20,20,0.08)` / `rgba(255,255,255,0.39)` with `blur(20px)` as the baseline glass treatment.
- Use monochrome contrast.
- Use translucent cards intentionally.
- Keep corners soft and generously rounded.
- Match blur strength to component size and purpose.
- Use top reflection for compact controls.
- Use top + bottom reflection for large surfaces.
- Use progressive blur for floating components over scrolling content.
- Maintain strong readability in both themes.
- Keep shadows subtle.
- Keep the overall interface clean and spacious.

### Don't

- **Do not use borders anywhere in the project UI.**
- Do not add translucent 1px borders to glass surfaces.
- Do not use heavy conventional drop shadows everywhere.
- Do not use the maximum blur value on every component.
- Do not force the same radius onto every element.
- Do not make every surface translucent.
- Do not sacrifice readability for the glass effect.
- Do not use decorative gradients as a substitute for hierarchy.
- Do not over-layer glass surfaces.
- Do not use progressive blur where a normal backdrop blur is sufficient.

---

## 24. Quick Reference

```text
BUNKMATES DESIGN SYSTEM

DARK MODE
Main Background     #000000
Glass Surface       rgba(20,20,20,0.08)
Primary CTA         #FFFFFF
CTA Foreground      #000000

LIGHT MODE
Main Background     #F1F1F1
Glass Surface       rgba(255,255,255,0.39)
Primary CTA         #000000
CTA Foreground      #FFFFFF

RADIUS
Typical Range       24px – 32px
Large Surfaces      May exceed 32px when appropriate

GLASS SURFACE
Standard Blur       20px
Border              NONE — use reflections

BACKDROP BLUR
Normal Range        10px – 40px
Progressive Blur    80px reference value

REFLECTION
Small Components    Top reflection
Large Components    Top + bottom reflection

PROGRESSIVE BLUR
Use for              Floating/sticky surfaces
Direction            Match top/bottom component placement
Height               Component dependent
```

---

## 24. Core Principle

> **BunkMates interfaces should feel layered, soft, minimal, and responsive without becoming visually excessive.**

When choosing between multiple visual treatments, prefer the implementation that preserves:

**clarity → hierarchy → consistency → softness → decoration**

The glass, reflection, and progressive blur effects support the interface; they should never overpower its content.
