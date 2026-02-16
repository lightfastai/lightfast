import type React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS } from "../shared/colors";
import { createBox, facePath, shapeBounds, project } from "../shared/iso";
import type { Box3D, Vec2 } from "../shared/iso";

const FACE_FILL: Record<string, string> = {
  top: COLORS.background,
  front: COLORS.background,
  right: COLORS.background,
};

const BOX: Box3D = { x: 0, y: 0, z: 0, w: 172, h: 172, d: 18 };

// Lissajous curve projected onto the top face
const topZ = BOX.z + BOX.d;
const cx = BOX.x + BOX.w / 2;
const cy = BOX.y + BOX.h / 2;
const STEPS = 512;

// Precompute projected points for path + length calculation
const lissajousPoints: Vec2[] = (() => {
  const pts: Vec2[] = [];
  for (let i = 0; i < STEPS; i++) {
    const t = (i / STEPS) * 2 * Math.PI;
    pts.push(
      project(
        cx + 60 * Math.sin(3 * t + Math.PI / 2),
        cy + 60 * Math.sin(2 * t),
        topZ,
      ),
    );
  }
  return pts;
})();

const lissajousPath =
  lissajousPoints
    .map(
      (v, i) =>
        `${i === 0 ? "M" : "L"}${v[0].toFixed(2)},${v[1].toFixed(2)}`,
    )
    .join(" ") + " Z";

// Total path length (including close segment)
const lissajousLength = (() => {
  let len = 0;
  for (let i = 1; i < lissajousPoints.length; i++) {
    const dx = lissajousPoints[i]![0] - lissajousPoints[i - 1]![0];
    const dy = lissajousPoints[i]![1] - lissajousPoints[i - 1]![1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  const last = lissajousPoints[lissajousPoints.length - 1]!;
  const first = lissajousPoints[0]!;
  len += Math.sqrt((first[0] - last[0]) ** 2 + (first[1] - last[1]) ** 2);
  return len;
})();

// Tracing animation constants
// Must divide evenly into 300 (composition loop point) for seamless GIF
const TRACE_LOOP_FRAMES = 150;
const TRAIL_FRACTION = 0.2;
const trailLength = lissajousLength * TRAIL_FRACTION;
const gapLength = lissajousLength - trailLength;

// Head dot: find the point index for a given progress [0,1]
function headPosition(progress: number): Vec2 {
  const idx = Math.floor(progress * STEPS) % STEPS;
  return lissajousPoints[idx]!;
}

const shape = createBox(BOX);
const bounds = shapeBounds(shape);

const PAD = 4;
const vx = bounds.minX - PAD;
const vy = bounds.minY - PAD;
const vw = bounds.maxX - bounds.minX + PAD * 2;
const vh = bounds.maxY - bounds.minY + PAD * 2;

export const LogoAnimation: React.FC = () => {
  const frame = useCurrentFrame();

  const progress = (frame % TRACE_LOOP_FRAMES) / TRACE_LOOP_FRAMES;
  const dashOffset = lissajousLength * (1 - progress);
  const head = headPosition(progress);

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      }}
    >
      <svg
        viewBox={`${vx} ${vy} ${vw} ${vh}`}
        width={vw}
        height={vh}
      >
        {shape.faces.map((face, i) => (
          <path
            key={i}
            d={facePath(face)}
            fill={FACE_FILL[face.type]}
            stroke={COLORS.border}
            strokeWidth={1}
            fillRule="evenodd"
          />
        ))}

        {/* Static base track — dim */}
        <path
          d={lissajousPath}
          fill="none"
          stroke={COLORS.border}
          strokeWidth={1}
        />

        {/* Animated comet trail */}
        <path
          d={lissajousPath}
          fill="none"
          stroke={COLORS.text}
          strokeWidth={1.5}
          strokeDasharray={`${trailLength} ${gapLength}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />

        {/* Head dot */}
        <circle
          cx={head[0]}
          cy={head[1]}
          r={2.5}
          fill={COLORS.primary}
        />
      </svg>
    </div>
  );
};
