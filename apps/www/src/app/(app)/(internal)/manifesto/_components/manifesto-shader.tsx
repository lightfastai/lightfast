"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";
import * as THREE from "three";

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
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

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
      new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms })
    );
    scene.add(mesh);

    // Resize handler
    const resize = () => {
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Cursor rect setup ─────────────────────────────────────────────────
    const cursor = cursorRef.current!;
    // Center rect on cursor hotspot via GSAP percentage offset
    gsap.set(cursor, { xPercent: -50, yPercent: -50 });

    const xTo = gsap.quickTo(cursor, "x", { duration: 0.3, ease: "power3" });
    const yTo = gsap.quickTo(cursor, "y", { duration: 0.3, ease: "power3" });

    // ── Interaction state ─────────────────────────────────────────────────
    let targetAmplitude = 0.65;
    let currentAmplitude = 0.65;
    let targetSpeed = 0.008;
    let currentSpeed = 0.008;

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
      gsap.to(cursor, { scale: 0.82, duration: 0.4, ease: "power2.out" });
    };

    const onUp = () => {
      targetAmplitude = 0.65;
      targetSpeed = 0.008;
      gsap.to(cursor, { scale: 1, duration: 0.3, ease: "power2.out" });
    };

    const onLeave = () => {
      targetAmplitude = 0.65;
      targetSpeed = 0.008;
      gsap.to(cursor, { opacity: 0, scale: 1, duration: 0.17 });
    };

    const wrapper = canvas.parentElement!;
    wrapper.addEventListener("mousemove", onMouseMove);
    wrapper.addEventListener("mouseenter", onEnter);
    wrapper.addEventListener("mousedown", onDown);
    wrapper.addEventListener("mouseup", onUp);
    wrapper.addEventListener("mouseleave", onLeave);
    wrapper.addEventListener("touchstart", onDown, { passive: true });
    wrapper.addEventListener("touchend", onUp);

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
      wrapper.removeEventListener("mousemove", onMouseMove);
      wrapper.removeEventListener("mouseenter", onEnter);
      wrapper.removeEventListener("mousedown", onDown);
      wrapper.removeEventListener("mouseup", onUp);
      wrapper.removeEventListener("mouseleave", onLeave);
      wrapper.removeEventListener("touchstart", onDown);
      wrapper.removeEventListener("touchend", onUp);
      renderer.dispose();
    };
  }, []);

  return (
    <>
      <div
        style={{
          position: "relative",
          overflow: "clip",
          width: "100%",
          height: "100%",
        }}
      >
        <canvas
          aria-hidden="true"
          ref={canvasRef}
          style={{ width: "100%", height: "100%", display: "block" }}
          tabIndex={-1}
        />
        {/* Vignette + inset border overlay */}
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
      </div>
      {/* Cursor rect — fixed, follows mouse via gsap.quickTo, xPercent/yPercent centers on hotspot */}
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
