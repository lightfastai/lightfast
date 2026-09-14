import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import {
  DOT_MATRIX_PATH,
  LOGO_DOT_DIAMETER,
} from "@repo/ui/components/brand/logo";
import { BRAND_CLEARSPACE, getBrandDimensions } from "./brand";

function paeth(a: number, b: number, c: number) {
  const prediction = a + b - c;
  const distances = [
    Math.abs(prediction - a),
    Math.abs(prediction - b),
    Math.abs(prediction - c),
  ];
  const minimum = Math.min(...distances);
  return distances[0] === minimum ? a : distances[1] === minimum ? b : c;
}

/** Decode Chromium's noninterlaced 8-bit RGB/RGBA output for content checks. */
export function decodePngPixels(png: Buffer) {
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.equal(png[24], 8, "PNG bit depth");
  assert.ok(png[25] === 2 || png[25] === 6, "PNG RGB/RGBA color type");
  assert.equal(png[28], 0, "PNG is not interlaced");
  const channels = png[25] === 2 ? 3 : 4;
  const chunks: Buffer[] = [];
  for (let offset = 8; offset < png.length; ) {
    const length = png.readUInt32BE(offset);
    if (png.toString("ascii", offset + 4, offset + 8) === "IDAT") {
      chunks.push(png.subarray(offset + 8, offset + 8 + length));
    }
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  assert.equal(raw.length, (stride + 1) * height);
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    assert.ok(filter <= 4, "PNG filter");
    for (let x = 0; x < stride; x++) {
      const index = y * stride + x;
      const a = x >= channels ? pixels[index - channels]! : 0;
      const b = y > 0 ? pixels[index - stride]! : 0;
      const c = y > 0 && x >= channels ? pixels[index - stride - channels]! : 0;
      const predictor = [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][
        filter
      ]!;
      pixels[index] = (raw[y * (stride + 1) + x + 1]! + predictor) & 255;
    }
  }
  return { pixels, channels, width, height };
}

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
