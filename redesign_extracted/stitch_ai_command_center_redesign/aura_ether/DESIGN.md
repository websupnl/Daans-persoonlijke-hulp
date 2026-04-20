# Design System Documentation: The Ethereal Intelligence

## 1. Overview & Creative North Star

This design system is not a utility; it is a digital sanctuary. Our Creative North Star is **"The Ethereal Intelligence."** Unlike traditional operating systems that feel like rigid grids of buttons and boxes, this system prioritizes a human, editorial experience. It is designed to feel like a premium concierge—composed, intelligent, and unobtrusive.

We move beyond "Standard UI" by embracing **Soft Minimalism**. We break the template look through:
*   **Intentional Asymmetry:** Off-center layouts that guide the eye naturally.
*   **Breathing Room:** Aggressive use of whitespace to reduce cognitive load.
*   **Tonal Depth:** Replacing harsh structural lines with soft shifts in light and color.

The goal is a "Human-Centric AI" interface that feels as tactile as fine stationery and as fluid as glass.

---

## 2. Color & Atmospheric Theory

Our palette is anchored in neutrals to allow the AI’s intelligence to take center stage without visual noise.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning or containment. Traditional "boxes" make software feel like a spreadsheet. Instead, define boundaries through:
1.  **Background Color Shifts:** Use `surface-container-low` for secondary sections sitting on a `surface` background.
2.  **Tonal Transitions:** A transition from `surface` to `surface-container` is all the eye needs to perceive a new zone.

### Surface Hierarchy & Nesting
Think of the UI as physical layers of frosted glass or fine vellum.
*   **Foundation:** Use `background` (#f9f9f8) for the base canvas.
*   **Layering:** Place a `surface-container-lowest` card on top of a `surface-container-low` area to create a soft, natural lift.
*   **Glassmorphism:** For overlays, modals, and navigation bars, use semi-transparent `surface` colors (approx. 70-80% opacity) paired with a high `backdrop-blur` (20px-40px). This ensures the AI feels integrated into the environment, not pasted on top of it.

### Signature Textures
To add "soul," use subtle linear gradients for primary actions. Instead of a flat `primary` fill, use a transition from `primary` (#5b5f65) to `primary_dim` (#4f5359) at a 135-degree angle. This mimics the way light hits a matte surface.

---

## 3. Typography: Editorial Authority

We use a high-contrast typographic scale to create an "Editorial" feel.

*   **The Display Duo:** We pair **Manrope** for headlines and **Inter** for body text. 
    *   **Manrope (Display/Headline):** This is our "voice." It is sophisticated and slightly more geometric, giving the AI an authoritative yet modern feel.
    *   **Inter (Body/Label):** This is our "engine." It is optimized for maximum readability at small sizes.
*   **Hierarchy as Navigation:** Use `display-lg` (3.5rem) for welcome states or high-level AI insights. The dramatic difference between `display-lg` and `body-md` (0.875rem) creates a visual rhythm that feels like a premium magazine.

---

## 4. Elevation & Depth

In this system, elevation is conveyed through light and shadow, not lines.

*   **Tonal Layering:** Avoid shadows for static elements. Use the `surface-container` tiers (Lowest to Highest) to "stack" content. An inner container should always be slightly lighter or darker than its parent to define its importance.
*   **Ambient Shadows:** When an element must "float" (like a dropdown or a floating action button), use an extra-diffused shadow.
    *   **Value:** Blur: 32px, Spread: -4px.
    *   **Color:** Use the `on-surface` color (#2f3333) at **4-8% opacity**. Never use pure black shadows; they look "dirty" on our off-white surfaces.
*   **The Ghost Border:** If accessibility requires a container edge, use the `outline-variant` token at **15% opacity**. It should be felt, not seen.

---

## 5. Component Logic

### Buttons & Interaction
*   **Primary:** Uses `primary` background with `on_primary` text. Roundedness: `xl` (1.5rem) to maintain the "Soft UI" feel.
*   **Secondary/Tertiary:** Use `surface-container-high` or transparent backgrounds. Interaction is signaled through a subtle shift to `surface-variant`.
*   **Hover States:** Elevate the element slightly by shifting the background tone (e.g., from `surface-container` to `surface-bright`) rather than adding a harsh border.

### Status Indicators (The Soft Accent)
Status should feel like a "gentle glow" rather than a "warning lamp."
*   **Success:** `tertiary` (soft purples/greens) or custom soft green.
*   **Error:** `error_container` (#fa746f) background with `on_error_container` text.
*   **Review/Pending:** Use `secondary_container` (soft blue/grey).

### Cards & Intelligence Feeds
*   **Strict Rule:** No divider lines. Use `1.5rem` to `2rem` of vertical whitespace to separate list items. 
*   **Glass Elements:** Use for the AI's "Input" bar. It should feel like a floating piece of glass at the bottom of the screen, utilizing `surface_container_lowest` with 80% opacity and a 24px blur.

### Inputs
*   **Styling:** Inputs should not look like empty boxes. Use `surface-container-low` as the background fill with a `12px` (md) corner radius. The label (`label-md`) should sit elegantly above the field in `on_surface_variant`.

---

## 6. Do’s and Don’ts

### Do:
*   **Embrace the "White Space":** If it feels like there is too much empty space, add a little more. This is an Operating System for focus.
*   **Use Soft Corners:** Stick strictly to the `12-16px` (lg to xl) range for all main containers.
*   **Prioritize Typography:** Let the font size and weight (Manrope for headers) do the work of organizing the page.

### Don’t:
*   **Don't use 100% Black:** Our "Deep Anthracite" is `on-surface` (#2f3333). Pure black (#000) breaks the ethereal, soft atmosphere.
*   **Don't use Dividers:** If you find yourself reaching for a `<hr>` or a 1px line, use a background color shift or more whitespace instead.
*   **Don't Over-shadow:** Shadows are for things that are *actively* floating over the UI. If it's part of the page, use tonal layering.

---

## 7. Roundedness Scale
*   **Default:** `0.5rem` (Internal elements like small buttons)
*   **Medium (md):** `0.75rem` (Inputs, small cards)
*   **Large (lg):** `1rem` (Main content cards)
*   **Extra Large (xl):** `1.5rem` (Outer containers, primary buttons)
*   **Full:** `9999px` (Pills, tags)