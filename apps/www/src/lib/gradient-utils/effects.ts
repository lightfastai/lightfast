import { createNoise2D } from "simplex-noise";

export function applyGrainEffect(
  ctx: CanvasRenderingContext2D,
  intensity = 0.15,
) {
  const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const data = imageData.data;
  const noise2D = createNoise2D();

  // Reduced amplitude for better compatibility
  const scale = 1;
  const amplitude = 50;

  // Process every pixel
  for (let i = 0; i < data.length; i += 4) {
    const x = (i / 4) % ctx.canvas.width;
    const y = Math.floor(i / 4 / ctx.canvas.width);

    // Generate monochromatic noise
    const noise = noise2D(x * scale, y * scale) * (intensity * amplitude);

    // Apply noise as a darker overlay
    const grainValue = Math.max(-30, Math.min(30, noise));

    // Apply to RGB channels
    data[i] = Math.max(0, data[i] + grainValue); // R
    data[i + 1] = Math.max(0, data[i + 1] + grainValue); // G
    data[i + 2] = Math.max(0, data[i + 2] + grainValue); // B
  }

  ctx.putImageData(imageData, 0, 0);
}
