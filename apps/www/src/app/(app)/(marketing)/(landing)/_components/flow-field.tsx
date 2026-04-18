"use client";

import { useEffect, useRef } from "react";

const CELL_SIZE = 28;
const LINE_RATIO = 0.7;
const LINE_WIDTH = 1;
const NOISE_SCALE = 0.0018;
const NOISE_TURNS = 0.35;
const SEED = 1337;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PERM = (() => {
  const rand = mulberry32(SEED);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j]!, p[i]!];
  }
  const ext = new Uint8Array(512);
  for (let i = 0; i < 512; i++) ext[i] = p[i & 255]!;
  return ext;
})();

function fade(t: number) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number) {
  return a + t * (b - a);
}

function grad(hash: number, x: number, y: number) {
  switch (hash & 3) {
    case 0:
      return x + y;
    case 1:
      return -x + y;
    case 2:
      return x - y;
    default:
      return -x - y;
  }
}

function perlin2(x: number, y: number) {
  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);
  const u = fade(xf);
  const v = fade(yf);
  const A = (PERM[X]! + Y) & 255;
  const B = (PERM[X + 1]! + Y) & 255;
  return lerp(
    lerp(grad(PERM[A]!, xf, yf), grad(PERM[B]!, xf - 1, yf), u),
    lerp(grad(PERM[A + 1]!, xf, yf - 1), grad(PERM[B + 1]!, xf - 1, yf - 1), u),
    v,
  );
}

function angleAt(x: number, y: number) {
  return perlin2(x * NOISE_SCALE, y * NOISE_SCALE) * NOISE_TURNS * Math.PI * 2;
}

function draw(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = rect.width;
  const h = rect.height;

  const styles = getComputedStyle(canvas);
  const bg = styles.getPropertyValue("--background").trim();
  const fg = styles.getPropertyValue("--border").trim();

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const cols = Math.floor(w / CELL_SIZE);
  const rows = Math.floor(h / CELL_SIZE);
  const offsetX = (w - cols * CELL_SIZE) / 2 + CELL_SIZE / 2;
  const offsetY = (h - rows * CELL_SIZE) / 2 + CELL_SIZE / 2;
  const length = CELL_SIZE * LINE_RATIO;

  ctx.strokeStyle = fg;
  ctx.lineWidth = LINE_WIDTH;
  ctx.lineCap = "round";

  ctx.beginPath();
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const cx = offsetX + i * CELL_SIZE;
      const cy = offsetY + j * CELL_SIZE;
      const a = angleAt(cx, cy);
      const dx = (Math.cos(a) * length) / 2;
      const dy = (Math.sin(a) * length) / 2;
      ctx.moveTo(cx - dx, cy - dy);
      ctx.lineTo(cx + dx, cy + dy);
    }
  }
  ctx.stroke();
}

export function FlowField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    draw(canvas);

    const onResize = () => draw(canvas);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
