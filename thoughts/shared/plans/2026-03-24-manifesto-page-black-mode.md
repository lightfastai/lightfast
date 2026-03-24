# Manifesto Page — Full Black Background + GLSL Shader

## Overview

Create a `/manifesto` page under `apps/www/src/app/(app)/(internal)/manifesto/` with:
1. A true black (`oklch(0 0 0)`) background mode scoped to the manifesto subtree
2. A fullscreen animated GLSL shader (Three.js + GSAP) as the visual backdrop — adapted from `thoughts/shared/research/2026-03-24-web-analysis-backhouse-glsl-shader-extraction.md`
3. Content overlaid on top of the shader

The page lives in `(internal)` — bypassing marketing chrome (AppNavbar, AppFooter, WaitlistCTA) — same pattern as pitch-deck.

## Current State Analysis

### Routing Structure
- `(internal)` has no group-level layout — each child brings its own layout
- `(internal)` inherits from `(app)/layout.tsx` (only CSS import + analytics)
- Pitch-deck is the only existing `(internal)` page — fully custom layout

### Theming System
- Entire www site is locked to dark mode via `<html class="dark">` at `apps/www/src/app/layout.tsx:141`
- CSS custom variant: `@custom-variant dark (&:is(.dark *))` at `packages/ui/src/globals.css:9`
- Current dark background is `oklch(0.2178 0 0)` — dark gray, NOT black
- True black requires CSS variable override scoped to the manifesto layout wrapper

### Shader Research (`thoughts/shared/research/2026-03-24-web-analysis-backhouse-glsl-shader-extraction.md`)
- Source: Backhouse.com hero — directly decompiled from CDN bundle
- Architecture: Three.js `ShaderMaterial` on a `PlaneGeometry(2,2)` quad, `OrthographicCamera(-1,1,1,-1)`
- Animation: GSAP ticker drives `uTime` increment; `uReveal` uniform fades from black (0→1)
- Interaction: mousedown/touchstart doubles amplitude + speed; lerped smoothly per frame
- Deps: `three@0.160.1`, `gsap` — **neither installed anywhere in monorepo**

### Key Discovery: Color Palette from Shader
```
uColors[0]  #000000  — Black (base/shadows)
uColors[1]  #eff2c0  — Pale yellow-green (bright highlight)
uColors[2]  #9feaf9  — Light cyan (cool)
uColors[3]  #769ba2  — Muted teal (ambient)
```
These blend via radial cosine weighting to create organic, animated color movement on a black base — ideal for the manifesto aesthetic.

## Desired End State

- `/manifesto` renders on a pure black background
- Fullscreen GLSL shader fills the viewport behind all content
- Shader fades from black on page load (`uReveal` tween, 2s, 0.3s delay)
- Hold-to-intensify interaction (mousedown/touchstart)
- Content (`h1`, body text) overlaid on top of the canvas with `position: absolute`
- No marketing chrome (navbar, footer, WaitlistCTA)
- No changes to global theming

### Verification
- `/manifesto` → black background, shader animates on load
- Hold click/touch → shader distortion visibly increases
- Release → smoothly returns to base
- `/blog` or `/` → standard dark gray unchanged
- `pnpm typecheck` passes
- `pnpm check` passes

## What We're NOT Doing

- Not adding a theme toggle
- Not modifying shared `globals.css` token sets
- Not creating a reusable "black mode" utility
- Not writing manifesto copy/prose (scaffolded placeholder only)
- Not adding navigation (follow-up)

## Implementation Approach

**Phase 1** (✅ complete): Layout with scoped CSS variable overrides + placeholder page scaffold.

**Phase 2** (✅ complete): Install `three` + `gsap` into `apps/www`, create client-side `ManifestoShader` component, wire into the page as fullscreen background.

**Phase 3** (current): Add a static rectangular "Hold" affordance element inside `ManifestoShader`. Driven by the same `onDown`/`onUp` event handlers already in the component — no new events, no prop drilling.

---

## Phase 1: Manifesto Layout with Black Mode ✅

### Overview
Manifesto route with a layout that overrides CSS variables to true black values.

### Files Created:
- `apps/www/src/app/(app)/(internal)/manifesto/layout.tsx`
- `apps/www/src/app/(app)/(internal)/manifesto/page.tsx`

### Layout — CSS Variable Override Pattern
```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manifesto",
  description: "The Lightfast manifesto.",
};

export default function ManifestoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="dark min-h-screen bg-background text-foreground"
      style={
        {
          "--background": "oklch(0 0 0)",
          "--foreground": "oklch(0.95 0 0)",
          "--card": "oklch(0.06 0 0)",
          "--card-foreground": "oklch(0.95 0 0)",
          "--popover": "oklch(0 0 0)",
          "--popover-foreground": "oklch(0.95 0 0)",
          "--muted": "oklch(0.12 0 0)",
          "--muted-foreground": "oklch(0.55 0 0)",
          "--border": "oklch(0.2 0 0)",
          "--accent": "oklch(0.12 0 0)",
          "--accent-foreground": "oklch(0.95 0 0)",
          "--input": "oklch(0.15 0 0)",
          "--input-bg": "oklch(0.06 0 0)",
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}
```

### Success Criteria:
#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [ ] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [x] Navigate to `/manifesto` → page renders on true black background
- [x] Inspect the wrapper div's computed `--background` → `oklch(0 0 0)`
- [x] Text is legible (white-ish on black)
- [ ] Navigate to `/` or `/blog` → standard dark gray background is unchanged
- [ ] No flash of wrong background color on page load

---

## Phase 2: GLSL Shader Background

### Overview
Add the Backhouse-derived animated GLSL shader as a fullscreen backdrop. The shader starts black and reveals color on load, making it indistinguishable from the black background until it blooms — an intentional reveal effect.

### Changes Required:

#### 1. Install Dependencies
**File**: `apps/www/package.json` — add to `dependencies`

Run from `apps/www/`:
```bash
pnpm add three gsap
pnpm add -D @types/three
```

**Versions to use**: `three@^0.160.1` (matches research source), `gsap@^3`

#### 2. Manifesto Shader Component
**File**: `apps/www/src/app/(app)/(internal)/manifesto/_components/manifesto-shader.tsx` (new)
**Purpose**: Client component wrapping the Three.js + GSAP animated canvas

```tsx
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";

// Color palette from research: thoughts/shared/research/2026-03-24-web-analysis-backhouse-glsl-shader-extraction.md
const COLORS = ["#000000", "#eff2c0", "#9feaf9", "#769ba2"] as const;

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;

  uniform float uTime;
  uniform float uAmplitude;
  uniform vec3 uColors[4];
  uniform float uReveal;

  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    vec2 c = 2.0 * uv - 1.0;
    float d = uAmplitude * uReveal;

    // Four layered sine-wave distortions on swapped axes
    c += d * 0.4 * sin(1.0 * c.yx + vec2(1.2, 3.4) + uTime);
    c += d * 0.2 * sin(5.2 * c.yx + vec2(3.5, 0.4) + uTime);
    c += d * 0.3 * sin(3.5 * c.yx + vec2(1.2, 3.1) + uTime);
    c += d * 1.6 * sin(0.4 * c.yx + vec2(0.8, 2.4) + uTime);

    // Blend 4 colors using radial cosine weight
    vec3 color = uColors[0];
    for (int i = 0; i < 4; i++) {
      float r = cos(float(i) * length(c));
      color = mix(color, uColors[i], r);
    }

    // Reveal: fade from black — gates both alpha and distortion
    gl_FragColor = vec4(mix(vec3(0.0), color, uReveal), 1.0);
  }
`;

export function ManifestoShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });

    // Scene + camera (orthographic fullscreen quad)
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    // Uniforms
    const uniforms = {
      uTime: { value: 0 },
      uAmplitude: { value: 0.65 },
      uReveal: { value: 0 },
      uColors: { value: COLORS.map((h) => new THREE.Color(h)) },
    };

    // Fullscreen quad
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms }),
    );
    scene.add(mesh);

    // Resize handler
    const resize = () => {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };
    resize();
    window.addEventListener("resize", resize);

    // Interaction: hold to intensify
    let targetAmplitude = 0.65;
    let currentAmplitude = 0.65;
    let targetSpeed = 0.008;
    let currentSpeed = 0.008;

    const onDown = () => {
      targetAmplitude = 1.3;
      targetSpeed = 0.012;
    };
    const onUp = () => {
      targetAmplitude = 0.65;
      targetSpeed = 0.008;
    };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mouseup", onUp);
    canvas.addEventListener("mouseleave", onUp);
    canvas.addEventListener("touchstart", onDown, { passive: true });
    canvas.addEventListener("touchend", onUp);

    // Render loop via GSAP ticker
    const tick = () => {
      currentAmplitude += (targetAmplitude - currentAmplitude) * 0.03;
      currentSpeed += (targetSpeed - currentSpeed) * 0.03;
      uniforms.uAmplitude.value = currentAmplitude;
      uniforms.uTime.value += currentSpeed;
      renderer.render(scene, camera);
    };
    gsap.ticker.add(tick);

    // Reveal animation: black → full color + distortion
    gsap.to(uniforms.uReveal, {
      value: 1,
      duration: 2,
      delay: 0.3,
      ease: "power2.inOut",
    });

    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("mouseleave", onUp);
      canvas.removeEventListener("touchstart", onDown);
      canvas.removeEventListener("touchend", onUp);
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}
```

**Notes:**
- `"use client"` — required: uses `useEffect`, `useRef`, browser APIs
- `pixelRatio` capped at 2 to avoid performance issues on retina displays
- `mouseleave` added to `onUp` to prevent stuck-high amplitude if cursor leaves canvas
- `{ passive: true }` on `touchstart` for scroll performance
- `renderer.dispose()` on cleanup to release WebGL context

#### 3. Updated Manifesto Page
**File**: `apps/www/src/app/(app)/(internal)/manifesto/page.tsx` (update)
**Purpose**: Layer content over the fullscreen shader canvas

```tsx
import { ManifestoShader } from "./_components/manifesto-shader";

export default function ManifestoPage() {
  return (
    <main className="relative min-h-screen">
      {/* Fullscreen shader backdrop */}
      <ManifestoShader />

      {/* Content overlay */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
        <div className="max-w-2xl space-y-8 text-center">
          <h1 className="font-pp text-4xl font-medium tracking-tight sm:text-5xl md:text-6xl">
            Manifesto
          </h1>
          <p className="text-lg text-muted-foreground">
            Coming soon.
          </p>
        </div>
      </div>
    </main>
  );
}
```

**Layout principle**: `main` is `relative`, shader canvas is `absolute inset-0`, content div is `relative z-10` — content sits above canvas in stacking context.

### Success Criteria:

#### Automated Verification:
- [x] `three` and `gsap` appear in `apps/www/package.json`
- [x] `@types/three` in devDependencies
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`
- [ ] Build succeeds: `pnpm build:www`

#### Manual Verification:
- [ ] Navigate to `/manifesto` → page starts pure black
- [ ] After 0.3s, shader gradually blooms into animated color (cyan/teal/pale yellow)
- [ ] Content text is readable over the shader
- [ ] Hold click/touch on the page → distortion visibly increases
- [ ] Release → smoothly returns to base animation
- [ ] Resize browser window → canvas fills viewport without gaps
- [ ] `/` and `/blog` → no shader, standard dark gray unchanged

---

## Phase 3: Hold Cursor Rect

### Overview
A fixed rectangular element that follows the mouse cursor via `gsap.quickTo`, signals the hold-to-intensify interaction. Appears when the cursor enters the canvas area, hides on leave. Scales down on mousedown synchronized with shader intensification. Rectangular shape (no border-radius) — Backhouse cursor pill aesthetic adapted to a rect.

### Changes Required:

#### 1. Updated `ManifestoShader` Component
**File**: `apps/www/src/app/(app)/(internal)/manifesto/_components/manifesto-shader.tsx` (update)

Add a `cursorRef`, `gsap.quickTo` for mouse following, and opacity/scale tweens into the existing `onDown`/`onUp`/`mouseleave` handlers:

```tsx
"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";

// ... (COLORS, vertexShader, fragmentShader unchanged)

export function ManifestoShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);  // ← new

  useEffect(() => {
    // ... (renderer, scene, camera, uniforms, mesh, resize — unchanged)

    // ── Cursor rect setup ────────────────────────────────────────────────
    const cursor = cursorRef.current!;

    // quickTo for smooth mouse following (0.3s lag, power3 ease)
    const xTo = gsap.quickTo(cursor, "x", { duration: 0.3, ease: "power3" });
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.3, ease: "power3" });

    const onMouseMove = (e: MouseEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
    };

    const onEnter = () => {
      gsap.to(cursor, { opacity: 1, duration: 0.17 });
    };

    const onDown = () => {
      targetAmplitude = 1.3;
      targetSpeed = 0.012;
      gsap.to(cursor, { scale: 0.82, duration: 0.4, ease: "power2.out" });  // ← new
    };
    const onUp = () => {
      targetAmplitude = 0.65;
      targetSpeed = 0.008;
      gsap.to(cursor, { scale: 1, duration: 0.3, ease: "power2.out" });     // ← new
    };
    const onLeave = () => {
      targetAmplitude = 0.65;
      targetSpeed = 0.008;
      gsap.to(cursor, { opacity: 0, scale: 1, duration: 0.17 });            // ← new
    };

    const wrapper = canvasRef.current!.parentElement!;
    wrapper.addEventListener("mousemove", onMouseMove);
    wrapper.addEventListener("mouseenter", onEnter);
    wrapper.addEventListener("mousedown", onDown);
    wrapper.addEventListener("mouseup", onUp);
    wrapper.addEventListener("mouseleave", onLeave);
    wrapper.addEventListener("touchstart", onDown, { passive: true });
    wrapper.addEventListener("touchend", onUp);

    // ... (tick, reveal — unchanged)

    return () => {
      // ... (existing cleanup)
      wrapper.removeEventListener("mousemove", onMouseMove);
      wrapper.removeEventListener("mouseenter", onEnter);
      wrapper.removeEventListener("mousedown", onDown);
      wrapper.removeEventListener("mouseup", onUp);
      wrapper.removeEventListener("mouseleave", onLeave);
      wrapper.removeEventListener("touchstart", onDown);
      wrapper.removeEventListener("touchend", onUp);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
      {/* Cursor rect — follows mouse, fixed positioned, driven by gsap.quickTo */}
      <div
        ref={cursorRef}
        className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 border border-white/40 px-4 py-2 opacity-0"
        aria-hidden="true"
      >
        <span className="text-[11px] font-medium uppercase tracking-widest text-white/60">
          Hold
        </span>
      </div>
    </>
  );
}
```

**Notes:**
- `fixed` positioning — cursor must be in viewport space, not document flow
- `-translate-x-1/2 -translate-y-1/2` — centers the rect on the cursor hotspot
- `opacity-0` initial state — cursor rect is hidden until `mouseenter`
- `gsap.quickTo` drives `x`/`y` CSS transforms with a 0.3s lag for smooth following
- No `rounded-*` — rectangular shape per intent
- `pointer-events-none` — all clicks/touches pass through to the canvas wrapper
- Event listeners moved from `canvas` to `canvas.parentElement` (the `<main>` wrapper) to cover the full page area, consistent with existing shader interaction
- `onLeave` resets scale to 1 in addition to hiding — prevents stuck scale if user releases outside canvas

### Success Criteria:

#### Automated Verification:
- [x] Type checking passes: `pnpm typecheck`
- [x] Linting passes: `pnpm check`

#### Manual Verification:
- [ ] Navigate to `/manifesto` → no cursor rect visible on load
- [ ] Move cursor over the page → rect appears and follows with smooth lag
- [ ] Move cursor off the page → rect fades out
- [ ] Hold click → rect scales to 0.82, shader distortion intensifies simultaneously
- [ ] Release → rect returns to scale 1, shader returns to base
- [ ] Cursor leaves canvas while held → rect fades + scale resets, shader resets
- [ ] Touch devices → no cursor rect (touch has no hover), hold interaction still works via touchstart/touchend

---

## Technical Notes

### Why Inline Style for CSS Variables?
CSS custom properties cascade — overriding them on the layout wrapper scopes the black theme to the entire manifesto subtree. `as React.CSSProperties` cast needed since TypeScript doesn't recognise custom properties by default.

### Why `absolute inset-0` on the Canvas?
The canvas must fill the viewport without affecting document flow. `absolute inset-0 h-full w-full` inside a `relative min-h-screen` parent achieves this. The content div uses `relative z-10` to sit above the canvas in the stacking order.

### Why GSAP Ticker Over `requestAnimationFrame`?
Matches the source implementation and avoids manual RAF management. GSAP's ticker is already likely used elsewhere in the codebase (pitch-deck interactions) and batches well with other animations. If GSAP is ever removed from the project, replacing with `requestAnimationFrame` is a trivial swap.

### `three` Version Pinning
Research was extracted from `three@0.160.1`. Using `^0.160.1` rather than latest to avoid breaking shader API changes — Three.js minor versions occasionally change `ShaderMaterial` uniform handling.

### Pixel Ratio Cap
`Math.min(window.devicePixelRatio, 2)` prevents the renderer from drawing at 3× or 4× on ultra-retina displays — the shader is not pixel-perfect detail work and doesn't benefit from the extra samples.

## Update Log

### 2026-03-24 — Add Phase 3: Hold Cursor Rect
- **Trigger**: Research doc `2026-03-24-web-analysis-backhouse-glsl-shader-extraction.md` described the cursor pill interaction; user wanted the cursor follower as a rectangle (not pill-shaped)
- **Changes**:
  - Added Phase 3 inside `ManifestoShader` — `cursorRef` + `gsap.quickTo` mouse follower + opacity/scale tweens
  - Rect is `fixed`, no rounding, hidden until `mouseenter`, follows cursor with 0.3s lag
  - Scale sync: `0.82` on mousedown, `1` on mouseup/mouseleave — matches shader intensification
  - Phase 2 marked complete in implementation overview
- **Impact on remaining work**: Phase 3 is the final phase — no downstream changes

---

## References

- Shader research: `thoughts/shared/research/2026-03-24-web-analysis-backhouse-glsl-shader-extraction.md`
- Root layout: `apps/www/src/app/layout.tsx:137-141` — hardcoded `dark` class
- CSS tokens: `packages/ui/src/globals.css:139-170` — dark mode variable set
- Dark variant: `packages/ui/src/globals.css:9` — `@custom-variant dark`
- Pitch deck pattern: `apps/www/src/app/(app)/(internal)/pitch-deck/layout.tsx` — custom internal layout
