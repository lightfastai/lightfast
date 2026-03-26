"use client";

import { ShaderMount } from "@paper-design/shaders-react";
import gsap from "gsap";
import { type ComponentRef, useEffect, useRef } from "react";

// Color palette from research: thoughts/shared/research/2026-03-24-web-analysis-backhouse-glsl-shader-extraction.md
// Passed as number[][] → ShaderMount flattens to uniform3fv for vec3[4]
type Vec3 = [number, number, number];
const COLORS: Vec3[] = [
  [0.0, 0.0, 0.0],
  [0.937, 0.949, 0.753],
  [0.624, 0.918, 0.976],
  [0.463, 0.608, 0.635],
];

// Same GLSL logic as original Three.js shader — ported to WebGL2 / GLSL 300 ES.
// Uses gl_FragCoord (equivalent to Three.js vUv since both use bottom-left origin).
// u_time / u_resolution / u_pixelRatio are provided automatically by ShaderMount.
const FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_pixelRatio;
uniform float u_amplitude;
uniform vec3 u_colors[4];

out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 c = 2.0 * uv - 1.0;
  float d = u_amplitude;

  c += d * 0.4 * sin(1.0 * c.yx + vec2(1.2, 3.4) + u_time);
  c += d * 0.2 * sin(5.2 * c.yx + vec2(3.5, 0.4) + u_time);
  c += d * 0.3 * sin(3.5 * c.yx + vec2(1.2, 3.1) + u_time);
  c += d * 1.6 * sin(0.4 * c.yx + vec2(0.8, 2.4) + u_time);

  vec3 color = u_colors[0];
  for (int i = 0; i < 4; i++) {
    float r = cos(float(i) * length(c));
    color = mix(color, u_colors[i], r);
  }

  fragColor = vec4(color, 1.0);
}`;

// Stable initial uniforms — defined outside component so React never re-sets them.
// u_amplitude is driven imperatively via GSAP; u_colors never changes.
const INITIAL_UNIFORMS = { u_amplitude: 0.65, u_colors: COLORS };

// ShaderMount speed maps to: u_time += (dt_ms * speed) * 0.001
// Original: u_time += 0.008/frame at 60fps = 0.48/s → speed = 0.48
// Mousedown: 0.012/frame = 0.72/s → speed = 0.72

export function ManifestoShader() {
  const shaderRef = useRef<ComponentRef<typeof ShaderMount>>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current!;
    const cursor = cursorRef.current!;
    const overlay = overlayRef.current!;

    // Center rect on cursor hotspot
    gsap.set(cursor, { xPercent: -50, yPercent: -50 });
    const xTo = gsap.quickTo(cursor, "x", { duration: 0.3, ease: "power3" });
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.3, ease: "power3" });

    // Reveal: black overlay fades out
    gsap.to(overlay, {
      opacity: 0,
      duration: 2,
      delay: 0.3,
      ease: "power2.inOut",
    });

    // Animation state — lerped each GSAP tick, then pushed to shader imperatively
    const cur = { amplitude: 0.65, speed: 0.48 };
    const tgt = { amplitude: 0.65, speed: 0.48 };

    const tick = () => {
      cur.amplitude += (tgt.amplitude - cur.amplitude) * 0.03;
      cur.speed += (tgt.speed - cur.speed) * 0.03;
      const sm = shaderRef.current?.paperShaderMount;
      if (sm) {
        sm.setUniforms({ u_amplitude: cur.amplitude });
        sm.setSpeed(cur.speed);
      }
    };
    gsap.ticker.add(tick);

    const onMouseMove = (e: MouseEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
    };
    const onEnter = () => gsap.to(cursor, { opacity: 1, duration: 0.17 });
    const onDown = () => {
      tgt.amplitude = 1.3;
      tgt.speed = 0.72;
      gsap.to(cursor, { scale: 0.82, duration: 0.4, ease: "power2.out" });
    };
    const onUp = () => {
      tgt.amplitude = 0.65;
      tgt.speed = 0.48;
      gsap.to(cursor, { scale: 1, duration: 0.3, ease: "power2.out" });
    };
    const onLeave = () => {
      tgt.amplitude = 0.65;
      tgt.speed = 0.48;
      gsap.to(cursor, { opacity: 0, scale: 1, duration: 0.17 });
    };

    wrapper.addEventListener("mousemove", onMouseMove);
    wrapper.addEventListener("mouseenter", onEnter);
    wrapper.addEventListener("mousedown", onDown);
    wrapper.addEventListener("mouseup", onUp);
    wrapper.addEventListener("mouseleave", onLeave);
    wrapper.addEventListener("touchstart", onDown, { passive: true });
    wrapper.addEventListener("touchend", onUp);

    return () => {
      gsap.ticker.remove(tick);
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
      <div
        ref={wrapperRef}
        style={{
          position: "relative",
          overflow: "clip",
          width: "100%",
          height: "100%",
        }}
      >
        <ShaderMount
          fragmentShader={FRAGMENT_SHADER}
          ref={shaderRef}
          speed={0.48}
          style={{ width: "100%", height: "100%" }}
          uniforms={INITIAL_UNIFORMS}
        />
        {/* Vignette + inset border */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 2,
            boxShadow: "rgb(0,0,0) 0px -2px 45px 30px inset",
            outline: "rgb(0,0,0) solid 3px",
            outlineOffset: "-1px",
          }}
        />
        {/* Reveal overlay: starts opaque, GSAP fades to transparent */}
        <div
          aria-hidden="true"
          ref={overlayRef}
          style={{
            position: "absolute",
            inset: 0,
            background: "#000",
            pointerEvents: "none",
            zIndex: 3,
          }}
        />
      </div>
      {/* Cursor rect — fixed, follows mouse via gsap.quickTo */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-50 border border-white/40 px-4 py-2 opacity-0"
        ref={cursorRef}
      >
        <span className="font-medium text-[11px] text-white/60 uppercase tracking-widest">
          Hold
        </span>
      </div>
    </>
  );
}
