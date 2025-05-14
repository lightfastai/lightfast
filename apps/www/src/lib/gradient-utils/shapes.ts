interface CircleProps {
  color: string;
  cx: number;
  cy: number;
}

type ShapeType = "circle" | "blob" | "wave" | "organic";

interface ShapeProps {
  type: ShapeType;
  color: string;
  x: number;
  y: number;
  size: number;
}

export function generateRandomShape(color: string): ShapeProps {
  const shapes: ShapeType[] = ["circle", "blob", "wave", "organic"];
  // Default to "blob" if for some reason the random selection fails
  const type = shapes[Math.floor(Math.random() * shapes.length)] || "blob";

  return {
    type,
    color,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 30,
  };
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: ShapeProps,
  circle: CircleProps,
) {
  const path = new Path2D();

  // Scale coordinates to canvas size
  const x = (circle.cx / 100) * ctx.canvas.width;
  const y = (circle.cy / 100) * ctx.canvas.height;

  // Generate blob path
  const points = 6;
  const radius = (30 / 100) * Math.min(ctx.canvas.width, ctx.canvas.height);
  const variance = 0.4;

  path.moveTo(x + radius, y);

  for (let i = 1; i <= points; i++) {
    const angle = (i * 2 * Math.PI) / points;
    const r = radius * (1 + (Math.random() - 0.5) * variance);
    const pointX = x + r * Math.cos(angle);
    const pointY = y + r * Math.sin(angle);

    const prevAngle = ((i - 1) * 2 * Math.PI) / points;
    const cpRadius = radius * (1.2 + Math.random() * 0.4);

    const cp1x = x + cpRadius * Math.cos(prevAngle + Math.PI / points);
    const cp1y = y + cpRadius * Math.sin(prevAngle + Math.PI / points);
    const cp2x = x + cpRadius * Math.cos(angle - Math.PI / points);
    const cp2y = y + cpRadius * Math.sin(angle - Math.PI / points);

    path.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, pointX, pointY);
  }

  path.closePath();
  ctx.fillStyle = circle.color;
  ctx.fill(path);
}
