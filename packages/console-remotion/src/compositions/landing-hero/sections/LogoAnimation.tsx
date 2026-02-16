import type React from "react";
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

const lissajousPath = (() => {
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
  return (
    pts
      .map(
        (v, i) =>
          `${i === 0 ? "M" : "L"}${v[0].toFixed(2)},${v[1].toFixed(2)}`,
      )
      .join(" ") + " Z"
  );
})();

const shape = createBox(BOX);
const bounds = shapeBounds(shape);

const PAD = 4;
const vx = bounds.minX - PAD;
const vy = bounds.minY - PAD;
const vw = bounds.maxX - bounds.minX + PAD * 2;
const vh = bounds.maxY - bounds.minY + PAD * 2;

export const LogoAnimation: React.FC = () => {
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
        <path
          d={lissajousPath}
          fill="none"
          stroke={COLORS.border}
          strokeWidth={1}
        />
      </svg>
    </div>
  );
};
