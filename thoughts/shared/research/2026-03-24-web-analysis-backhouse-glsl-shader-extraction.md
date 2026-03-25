---
date: 2026-03-24T00:00:00+11:00
researcher: claude-sonnet-4-6
topic: "GLSL shader + pill UI + interaction extraction from backhouse.com hero section"
tags: [research, web-analysis, glsl, three-js, shader, visual-fx, pill-button, custom-cursor, gsap]
status: complete
created_at: 2026-03-24
confidence: high
sources_count: 1
---

# Web Research: Backhouse.com GLSL Shader

**Date**: 2026-03-24
**Topic**: Extract the GLSL shader, component structure, and colors from https://www.backhouse.com/
**Confidence**: High — shader source was directly decompiled from the live bundle

---

## Research Question

Extract the full GLSL shader (vertex + fragment), color palette, and config from the animated gradient hero on backhouse.com. Document exact DOM/JS locations so the component is replicable.

---

## Executive Summary

Backhouse.com's hero uses a fullscreen Three.js `ShaderMaterial` on a `PlaneGeometry(2,2)` quad. The fragment shader applies four layered sine-wave distortions to UV coordinates driven by `uTime`, then blends four palette colors using a radial cosine mix. The whole setup is roughly **120 lines of JS** inside a minified bundle at `cdn.odyn.dev`. A GSAP ticker drives the render loop and a mouse/touch hold interaction doubles the distortion amplitude.

---

## How to Find It (Replicable Process)

### Step 1 — Identify the canvas element

Open DevTools → Elements tab. The canvas sits inside a wrapper div with class `hero_home_shader`. The canvas itself has class `hero_home_canvas`.

```html
<!-- DOM location -->
<div class="hero_home_shader">
  <canvas class="hero_home_canvas"></canvas>
</div>
```

### Step 2 — Find the JS bundle

Open DevTools → Network tab → filter by JS. On page load a single CDN bundle is fetched:

```
https://cdn.odyn.dev/p/u8mh/bundle.js   (16,127 bytes, minified)
```

### Step 3 — Locate the shader in the bundle

Search the bundle source for `gl_FragColor`. The shader code is stored as template literals inside the `ShaderMaterial` constructor call. Pattern to search:

- `gl_FragColor` → fragment shader end
- `gl_Position` → vertex shader end
- `uColors` → uniform array declaration

The relevant class/IIFE wraps a Three.js `WebGLRenderer`, an `OrthographicCamera`, and a `Mesh` with `ShaderMaterial`.

---

## Component Architecture

### DOM structure

```
SECTION.hero_home_wrap
  DIV.hero_home_contain  [display: grid, 12-col]
    DIV.hero_bottom_shader_wrap  [position: relative, overflow: clip, data-cursor=""]
      DIV.hero_home_shader       [pill container — clips the canvas]
        CANVAS.hero_home_canvas  [WebGL surface, fills 100%/100%]
        DIV.hero_home_overlay    [vignette + inset border, z-index: 2]
```

### Pill container CSS

```css
.hero_home_shader {
  width: 100%;                      /* --max-width--full */
  border-radius: 100vw;             /* --radius--round → 1426px computed */
  height: max(15svh, 27svw);        /* fluid height, adapts to viewport */
  max-height: 35svh;                /* cap — never taller than 35% of viewport */
  position: relative;
  overflow: clip;                   /* clips canvas corners to pill shape */
}
```

`overflow: clip` is the key — the canvas has no border-radius of its own; the pill clipping comes entirely from the parent.

### Canvas CSS

```css
.hero_home_canvas {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0%;
  z-index: 1;
}
```

### Overlay (vignette + inset border)

```css
.hero_home_overlay {
  width: 100%;
  height: 100%;
  position: absolute;
  inset: 0%;
  z-index: 2;
  border-radius: 100vw;                         /* matches pill shape */
  pointer-events: none;
  box-shadow: rgb(0, 0, 0) 0px -2px 45px 30px inset;  /* dark edge vignette */
  outline: rgb(0, 0, 0) solid 3px;             /* inset border around pill */
  outline-offset: -1px;
}
```

The overlay is what creates the dark vignette fade at the pill edges — a solid black `inset` box-shadow, plus a 3px black outline sitting flush inside the pill border. It sits above the canvas (z-index 2) but has `pointer-events: none` so it doesn't block shader interaction.

### Dimensions at 1366px viewport

| Property | Value |
|----------|-------|
| Width | 1366px (100% of container) |
| Height | ~294px (`max(15svh, 27svw)` resolved) |
| Aspect ratio | ~4.65:1 |
| Canvas internal resolution | 2732 × 588px (2× DPR) |

### Three.js setup (inside the canvas)

```
THREE.WebGLRenderer  (canvas: .hero_home_canvas)
THREE.Scene
THREE.OrthographicCamera  (-1, 1, 1, -1, 0.1, 10)
THREE.Mesh
  ├── THREE.PlaneGeometry(2, 2)         ← fullscreen quad
  └── THREE.ShaderMaterial
      ├── vertexShader   (passthrough)
      ├── fragmentShader (distortion + color blend)
      └── uniforms
          ├── uTime       { value: 0 }
          ├── uAmplitude  { value: 0.65 }
          ├── uReveal     { value: 0 }       ← GSAP tween target
          └── uColors     { value: [c1, c2, c3, c4] }
```

**Dependencies**:
- `three@0.160.1`
- `gsap@3.14.2` (ticker + reveal tween)

---

## Vertex Shader

Standard Three.js UV passthrough — nothing custom here.

```glsl
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
```

---

## Fragment Shader

```glsl
precision mediump float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColors[4];
uniform float uReveal;

varying vec2 vUv;

void main() {
  vec2 uv = vUv;
  vec2 centeredUv = 2.0 * uv - 1.0;
  float distortionStrength = uAmplitude * uReveal;

  // Four layered sine-wave distortions on swapped axes
  centeredUv += distortionStrength * 0.4 * sin(1.0 * centeredUv.yx + vec2(1.2, 3.4) + uTime);
  centeredUv += distortionStrength * 0.2 * sin(5.2 * centeredUv.yx + vec2(3.5, 0.4) + uTime);
  centeredUv += distortionStrength * 0.3 * sin(3.5 * centeredUv.yx + vec2(1.2, 3.1) + uTime);
  centeredUv += distortionStrength * 1.6 * sin(0.4 * centeredUv.yx + vec2(0.8, 2.4) + uTime);

  // Blend 4 colors using radial cosine weight
  vec3 color = uColors[0];
  for (int i = 0; i < 4; i++) {
    float r = cos(float(i) * length(centeredUv));
    color = mix(color, uColors[i], r);
  }

  // Reveal: fade from black
  gl_FragColor = vec4(mix(vec3(0.0), color, uReveal), 1.0);
}
```

### How the distortion works

1. UV remap to `[-1, 1]` centered space
2. Four `sin()` passes each warp `centeredUv` using **swapped XY** (`centeredUv.yx`) — this creates diagonal/rotational flow
3. Each pass has a different frequency (0.4, 5.2, 3.5, 0.4), phase offset vector, and amplitude weight (0.4, 0.2, 0.3, 1.6)
4. All distortion is gated by `distortionStrength = uAmplitude * uReveal` — zero at page load, full at reveal complete

### How the color blend works

The `for` loop iterates 4 colors. For each color `i`, it computes `r = cos(i * length(centeredUv))` — a radial cosine function. Because `length(centeredUv)` varies across the screen, different colors dominate at different distances from center. The `mix()` chain progressively blends all 4 colors based on their radial distance weight.

---

## Color Palette

```js
// Three.js Color objects passed as uColors[4]
const color1 = new THREE.Color('#000000'); // Black
const color2 = new THREE.Color('#eff2c0'); // Pale yellow-green
const color3 = new THREE.Color('#9feaf9'); // Light cyan
const color4 = new THREE.Color('#769ba2'); // Muted teal
```

| Index | Hex | RGB | Role |
|-------|-----|-----|------|
| `uColors[0]` | `#000000` | `0, 0, 0` | Base / shadows |
| `uColors[1]` | `#eff2c0` | `239, 242, 192` | Bright highlight band |
| `uColors[2]` | `#9feaf9` | `159, 234, 249` | Cool cyan highlight |
| `uColors[3]` | `#769ba2` | `118, 155, 162` | Ambient teal fill |

---

## Full Config / Uniforms

| Parameter | Value | Purpose |
|-----------|-------|---------|
| `uAmplitude` | `0.65` | Base distortion intensity |
| `uTime` | `+= timeSpeed` per frame | Animation clock |
| `uReveal` | `0 → 1` via GSAP | Fade-in multiplier |
| `timeSpeed` | `0.008` | Time increment per tick |
| `holdAmplitudeMultiplier` | `2.0` | Amplitude on mousedown/touchstart |
| `holdTimeSpeedMultiplier` | `1.5` | Speed multiplier on hold |
| `lerpSpeed` | `0.03` | Lerp factor for smooth value transitions |
| `revealDuration` | `2s` | GSAP reveal animation duration |
| `revealDelay` | `0.3s` | GSAP reveal delay |
| `revealEase` | `cubic-bezier(0.31, 0.75, 0.22, 1)` | Custom GSAP ease |

---

## Interaction System

```js
// On mousedown / touchstart
targetAmplitude = baseAmplitude * holdAmplitudeMultiplier; // 0.65 * 2 = 1.3
targetTimeSpeed = timeSpeed * holdTimeSpeedMultiplier;     // 0.008 * 1.5 = 0.012

// On mouseup / touchend
targetAmplitude = baseAmplitude; // back to 0.65
targetTimeSpeed = timeSpeed;     // back to 0.008

// Per-frame lerp (inside GSAP ticker)
currentAmplitude += (targetAmplitude - currentAmplitude) * lerpSpeed;
currentTimeSpeed += (targetTimeSpeed - currentTimeSpeed) * lerpSpeed;
uniforms.uAmplitude.value = currentAmplitude;
uniforms.uTime.value += currentTimeSpeed;
```

---

## Reveal Animation

```js
gsap.to(uniforms.uReveal, {
  value: 1,
  duration: 2,
  delay: 0.3,
  ease: 'cubic-bezier(0.31, 0.75, 0.22, 1)',
});
```

The `uReveal` uniform is both the fade-in alpha (`mix(vec3(0), color, uReveal)`) and the distortion gate (`distortionStrength = uAmplitude * uReveal`). So the effect starts still and black, then warps into full color simultaneously.

---

## Minimal Replication (React / Three.js)

```tsx
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import gsap from 'gsap';

const COLORS = ['#000000', '#eff2c0', '#9feaf9', '#769ba2'];

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
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

    c += d * 0.4 * sin(1.0 * c.yx + vec2(1.2, 3.4) + uTime);
    c += d * 0.2 * sin(5.2 * c.yx + vec2(3.5, 0.4) + uTime);
    c += d * 0.3 * sin(3.5 * c.yx + vec2(1.2, 3.1) + uTime);
    c += d * 1.6 * sin(0.4 * c.yx + vec2(0.8, 2.4) + uTime);

    vec3 color = uColors[0];
    for (int i = 0; i < 4; i++) {
      float r = cos(float(i) * length(c));
      color = mix(color, uColors[i], r);
    }

    gl_FragColor = vec4(mix(vec3(0.0), color, uReveal), 1.0);
  }
`;

export function BackhouseShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 1;

    const uniforms = {
      uTime: { value: 0 },
      uAmplitude: { value: 0.65 },
      uReveal: { value: 0 },
      uColors: { value: COLORS.map(h => new THREE.Color(h)) },
    };

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms })
    );
    scene.add(mesh);

    const resize = () => {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    let targetAmplitude = 0.65;
    let currentAmplitude = 0.65;
    let targetSpeed = 0.008;
    let currentSpeed = 0.008;

    const onDown = () => { targetAmplitude = 1.3; targetSpeed = 0.012; };
    const onUp   = () => { targetAmplitude = 0.65; targetSpeed = 0.008; };
    canvas.addEventListener('mousedown', onDown);
    canvas.addEventListener('mouseup', onUp);
    canvas.addEventListener('touchstart', onDown);
    canvas.addEventListener('touchend', onUp);

    const tick = () => {
      currentAmplitude += (targetAmplitude - currentAmplitude) * 0.03;
      currentSpeed     += (targetSpeed     - currentSpeed)     * 0.03;
      uniforms.uAmplitude.value = currentAmplitude;
      uniforms.uTime.value     += currentSpeed;
      renderer.render(scene, camera);
    };
    gsap.ticker.add(tick);

    gsap.to(uniforms.uReveal, { value: 1, duration: 2, delay: 0.3, ease: 'power2.inOut' });

    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener('resize', resize);
      renderer.dispose();
    };
  }, []);

  return (
    <div style={{ position: 'relative', overflow: 'clip' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      {/* vignette + inset border overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
        borderRadius: '100vw',
        boxShadow: 'rgb(0,0,0) 0px -2px 45px 30px inset',
        outline: 'rgb(0,0,0) solid 3px',
        outlineOffset: '-1px',
      }} />
    </div>
  );
}

// Usage — pill shape via Tailwind:
// <div className="relative w-full overflow-clip rounded-[100vw]"
//      style={{ height: 'max(15svh, 27svw)', maxHeight: '35svh' }}>
//   <BackhouseShader />
// </div>
```

---

## Grain Effect

**Technique**: Static noise PNG + CSS `transform: translate` with `steps()` timing. No SVG feTurbulence, no canvas, no JS.

### DOM

Direct child of `<body>`, highest z-index on the page:

```html
<div class="g_grain_overlay u-grain-animate">
  <div class="w-embed">
    <!-- inline <style> injected via Webflow w-embed -->
  </div>
</div>
```

### Full CSS

```css
.g_grain_overlay {
  position: fixed;
  width: 200%;              /* 2× viewport — prevents edges showing during translation */
  height: 200vh;
  inset: -50% 0% 0% -50%;  /* offset so translations have room in all directions */
  z-index: 999999999;
  opacity: 0.8;
  pointer-events: none;
  mix-blend-mode: normal;
  background-image: url("https://cdn.prod.website-files.com/69733e404ee2e7c008f4d29a/6975ecc179fa2d60a979b232_download.png");
  background-attachment: fixed; /* texture stays fixed to viewport, only transform moves it */
  background-size: auto;
  will-change: transform;
}

@keyframes grain-animation {
  0%,  100% { transform: translate(0,     0);    }
  17%        { transform: translate(-5%,  -10%); }
  33%        { transform: translate(3%,   -15%); }
  50%        { transform: translate(12%,  9%);   }
  67%        { transform: translate(9%,   4%);   }
  83%        { transform: translate(-1%,  7%);   }
}

.u-grain-animate {
  animation: grain-animation 0.5s steps(6) infinite;
}
```

### Key design decisions

| Property | Value | Why |
|----------|-------|-----|
| `width: 200%` / `height: 200vh` | 2× viewport | Prevents edge gaps when translated |
| `inset: -50% 0% 0% -50%` | Top-left offset | Centers the oversized div so all 6 positions stay within viewport |
| `animation: 0.5s steps(6) infinite` | Stepped, not eased | Jumps discretely — no tween between positions. Mimics film grain flicker |
| `mix-blend-mode: normal` | No blending | Grain sits on top at 0.8 opacity, darkening whatever is beneath |
| `background-attachment: fixed` | Viewport-locked | Texture doesn't scroll — only the transform moves it |
| `will-change: transform` | GPU layer | Compositor layer → smooth 60fps at near-zero CPU cost |
| `pointer-events: none` | Passthrough | Invisible to all mouse/touch events |

### Texture image

```
https://cdn.prod.website-files.com/69733e404ee2e7c008f4d29a/6975ecc179fa2d60a979b232_download.png
```

Monochrome noise PNG, ~2852 × 1682px, hosted on Webflow CDN. Any similar tileable noise texture works as a drop-in replacement.

### Replication (Tailwind)

```html
<div class="grain-overlay grain-animate" />
```

```css
.grain-overlay {
  @apply fixed pointer-events-none;
  width: 200%;
  height: 200vh;
  inset: -50% 0 0 -50%;
  z-index: 9999;
  opacity: 0.8;
  background-image: url('/noise.png');
  background-attachment: fixed;
  background-size: auto;
  will-change: transform;
}

@keyframes grain {
  0%,  100% { transform: translate(0,    0);    }
  17%        { transform: translate(-5%, -10%); }
  33%        { transform: translate(3%,  -15%); }
  50%        { transform: translate(12%, 9%);   }
  67%        { transform: translate(9%,  4%);   }
  83%        { transform: translate(-1%, 7%);   }
}

.grain-animate {
  animation: grain 0.5s steps(6) infinite;
}
```

---

## Pill Elements & Click Effects

Two distinct pill-shaped elements exist on the page. Both use `border-radius: 100vw` (resolved from `--radius--round`).

---

### 1. "Partner with us" CTA Button

**DOM structure:**

```html
<div class="button_main_wrap">        <!-- visual pill shell -->
  <div class="clickable_wrap">        <!-- absolute inset, captures pointer events -->
    <button class="clickable_btn">    <!-- actual button (shown when link href="#") -->
      <span class="button_main_text">Partner with us</span>
    </button>
  </div>
</div>
```

**CSS (resolved):**

```css
.button_main_wrap {
  border-radius: 100vw;               /* --radius--round */
  background-color: #ececec;          /* --swatch--white */
  color: #0b0b0b;                     /* --swatch--black */
  padding: clamp(0.875rem, fluid, 1rem);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: color 0.2s, background-color 0.2s;
}

.button_main_wrap:hover {
  background-color: #0b0b0b;          /* --button-primary--background-hover */
  color: #ececec;                     /* inverted */
}
```

**Design tokens:**

| Token | Value |
|-------|-------|
| `--radius--round` | `100vw` |
| `--swatch--white` | `#ececec` |
| `--swatch--black` | `#0b0b0b` |

**Click effect:** Opens a contact form panel via GSAP timeline:
1. `.form_wrap` → `pointer-events: auto; opacity: 1`
2. `.form_bg` → `opacity: 0 → 1` over `0.4s`
3. `.form_contain` → `yPercent: 100 → 0` over `1.5s` (`ease-secondary: cubic-bezier(0.31, 0.75, 0.22, 1)`)
4. Stops main Lenis scroll, starts form's own Lenis scroll instance

No ripple, no scale, no color flash on click — purely a slide-in panel.

---

### 2. Custom Cursor Pill (`.cursor`)

The cursor is a fixed pill that appears when hovering any `[data-cursor]` element. It says **"Hold"** — it is the visual affordance for the shader hold interaction.

**DOM:**
```html
<div class="cursor">
  <p class="cursor_text">Hold</p>
</div>
```

**CSS:**
```css
.cursor {
  border-radius: 100vw;
  border: 0.6px solid #ececec;
  background: transparent;
  padding: 0.8rem 0.9rem;
  opacity: 0;
  pointer-events: none;
  position: fixed;
  top: 0; left: 0;
  z-index: 10;
  transition: opacity 0.17s cubic-bezier(0.626, 0.011, 0.25, 1);
}

/* Becomes visible when hovering a [data-cursor] element */
body:has([data-cursor]:hover) .cursor { opacity: 1; }
```

**JS behavior (GSAP):**

```js
// Mouse following — smooth lag via quickTo
const xTo = gsap.quickTo(cursor, 'x', { duration: 0.3, ease: 'power3' });
const yTo = gsap.quickTo(cursor, 'y', { duration: 0.3, ease: 'power3' });
window.addEventListener('mousemove', e => { xTo(e.clientX); yTo(e.clientY); });

// Appear/disappear with text slide on [data-cursor] hover
// onMouseenter: cursor text slides in from y:15, duration 0.25s
// onMouseleave: timeline.reverse()

// Scale on hold
canvas.addEventListener('mousedown', () => {
  gsap.to(cursor, { scale: 0.82, duration: 0.4, ease: 'power2.out' });
});
window.addEventListener('mouseup', () => {
  gsap.to(cursor, { scale: 1, duration: 0.3, ease: 'power2.out' });
});
```

The canvas element itself has `data-cursor` attribute, so hovering the hero reveals the pill cursor. Clicking/holding it shrinks the pill (scale 0.82) — simultaneously triggering the shader distortion ramp-up.

---

### Shader ↔ Cursor Connection

The `.cursor` pill and the GLSL `uAmplitude` uniform are driven by the **same `mousedown`/`mouseup` events** on the canvas:

```
mousedown on canvas
  ├── GSAP: cursor pill → scale: 0.82
  └── Shader: targetAmplitude = 0.65 * 2 = 1.3, targetSpeed = 0.012

mouseup
  ├── GSAP: cursor pill → scale: 1
  └── Shader: targetAmplitude = 0.65, targetSpeed = 0.008
```

The cursor squish and the shader turbulence are intentionally synchronized — squeezing the cursor pill = squeezing the shader.

---

## Sources

### Live extraction
- [https://www.backhouse.com/](https://www.backhouse.com/) — Direct page analysis, 2026-03-24
- Bundle: `https://cdn.odyn.dev/p/u8mh/bundle.js` — Minified JS, decompiled via browser DevTools

---

**Last Updated**: 2026-03-24
**Confidence Level**: High — shader code was directly read from the decompiled bundle, not reconstructed
**Next Steps**: Adapt `BackhouseShader` component above or swap in different `COLORS` and distortion coefficients
