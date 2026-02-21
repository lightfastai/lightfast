import type React from "react";
import { AbsoluteFill } from "remotion";

// import { useEffect, useState } from "react";
// import { delayRender, continueRender } from "remotion";
// import { ensureFontsLoaded } from "./fonts";

// // ── Lissajous patterns (from render-lissajous.ts FOOTER_PATTERNS) ────────
//
// const LISSAJOUS_PATTERNS = [
//   { name: "circle", a: 1, b: 1, delta: Math.PI / 2 },
//   { name: "figure8", a: 1, b: 2, delta: Math.PI / 2 },
//   { name: "pretzel", a: 3, b: 2, delta: Math.PI / 2 },
//   { name: "bow", a: 2, b: 3, delta: Math.PI / 2 },
//   { name: "knot", a: 3, b: 4, delta: Math.PI / 2 },
//   { name: "star", a: 5, b: 4, delta: Math.PI / 2 },
//   { name: "wave", a: 1, b: 3, delta: Math.PI / 4 },
//   { name: "infinity", a: 2, b: 1, delta: Math.PI / 2 },
//   { name: "clover", a: 3, b: 1, delta: Math.PI / 2 },
// ] as const;
//
// const CURVE_SIZE = 120;
// const VIEWBOX = 100;
//
// // ── Lissajous path computation (same math as render-lissajous.ts) ────────
//
// function computePath(
//   a: number,
//   b: number,
//   delta: number,
//   points = 500,
//   padding = 10,
// ): string {
//   const size = VIEWBOX - padding * 2;
//   const pts: { x: number; y: number }[] = [];
//
//   for (let i = 0; i <= points; i++) {
//     const t = (i / points) * 2 * Math.PI;
//     pts.push({
//       x: padding + ((Math.sin(a * t + delta) + 1) / 2) * size,
//       y: padding + ((Math.sin(b * t) + 1) / 2) * size,
//     });
//   }
//
//   return pts
//     .map(
//       (p, i) =>
//         `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`,
//     )
//     .join(" ");
// }

// ── Component ─────────────────────────────────────────────────────────────

export const TwitterBanner: React.FC = () => {
  // const [handle] = useState(() => delayRender("Loading fonts"));
  //
  // useEffect(() => {
  //   void ensureFontsLoaded()
  //     .then(() => continueRender(handle))
  //     .catch((err: unknown) => {
  //       console.error("Font loading failed:", err);
  //       continueRender(handle);
  //     });
  // }, [handle]);

  return (
    <AbsoluteFill className="bg-black">
      {/* Lissajous row — commented out for now */}
      {/* <div className="absolute top-6 right-10 flex items-start gap-5">
        {LISSAJOUS_PATTERNS.map((pattern) => (
          <svg
            key={pattern.name}
            width={CURVE_SIZE}
            height={CURVE_SIZE}
            viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          >
            <path
              d={computePath(pattern.a, pattern.b, pattern.delta)}
              fill="none"
              className="stroke-white"
              strokeWidth={1.2}
            />
          </svg>
        ))}
      </div> */}
    </AbsoluteFill>
  );
};
