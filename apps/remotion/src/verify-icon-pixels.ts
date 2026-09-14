import assert from "node:assert/strict";
import {
  DOT_MATRIX_PATH,
  LOGO_DOT_DIAMETER,
} from "@repo/ui/components/brand/logo";
import { BRAND_CLEARSPACE, getBrandDimensions } from "./brand";
import { decodePngPixels } from "./png-codec";

export function verifyIconPixels(png: Buffer, size: number) {
  const { pixels, channels } = decodePngPixels(png);
  const scale = size / getBrandDimensions().width;
  const radius = LOGO_DOT_DIAMETER / 2;
  const centers = [...DOT_MATRIX_PATH.matchAll(/M(\d+) (\d+)a/g)].map(
    (match) => [Number(match[1]) - radius, Number(match[2])]
  );
  const coverage = new Array<number>(centers.length).fill(0);
  let minX = size;
  let minY = size;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * channels;
      const red = pixels[index]!;
      assert.equal(red, pixels[index + 1], "neutral grayscale");
      assert.equal(red, pixels[index + 2], "neutral grayscale");
      if (channels === 4) {
        assert.equal(pixels[index + 3], 255, "opaque icon");
      }
      if (red === 255) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      const sourceX = (x + 0.5) / scale - BRAND_CLEARSPACE;
      const sourceY = (y + 0.5) / scale - BRAND_CLEARSPACE;
      const distances = centers.map(([cx, cy]) =>
        Math.hypot(sourceX - cx!, sourceY - cy!)
      );
      const closest = Math.min(...distances);
      assert.ok(
        closest <= radius + 1 / scale,
        "foreground follows canonical circles within one antialiased pixel"
      );
      coverage[distances.indexOf(closest)]! += (255 - red) / 255;
    }
  }
  const margin = Math.floor(BRAND_CLEARSPACE * scale);
  assert.ok(
    Math.abs(minX - margin) <= 1 && Math.abs(minY - margin) <= 1,
    "3L top/left clearspace"
  );
  assert.ok(
    Math.abs(maxX - (size - 1 - margin)) <= 1 &&
      Math.abs(maxY - (size - 1 - margin)) <= 1,
    "3L bottom/right clearspace"
  );
  if (size >= 180) {
    const expectedArea = Math.PI * (radius * scale) ** 2;
    for (const area of coverage) {
      assert.ok(
        Math.abs(area / expectedArea - 1) < 0.08,
        "every canonical dot retains its expected coverage"
      );
    }
  }
}
