import assert from "node:assert/strict";
import { crc32, deflateSync, inflateSync } from "node:zlib";

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

/** Expand RGB to opaque RGBA without changing any decoded color samples. */
export function rgbaPixels(png: Buffer) {
  const { pixels, channels, width, height } = decodePngPixels(png);
  if (channels === 4) {
    return pixels;
  }
  const rgba = Buffer.alloc(width * height * 4, 255);
  for (let pixel = 0; pixel < width * height; pixel++) {
    pixels.copy(rgba, pixel * 4, pixel * 3, pixel * 3 + 3);
  }
  return rgba;
}

function chunk(type: string, data: Buffer) {
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  result.write(type, 4, 4, "ascii");
  data.copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, -4)), result.length - 4);
  return result;
}

/** ICO consumers such as Next.js require RGBA PNG frames, even when opaque. */
export function toRgbaPng(png: Buffer): Buffer {
  const { width, height } = decodePngPixels(png);
  const pixels = rgbaPixels(png);
  const header = Buffer.from(png.subarray(16, 29));
  header[9] = 6;
  const stride = width * 4;
  const scanlines = Buffer.alloc((stride + 1) * height);
  for (let row = 0; row < height; row++) {
    pixels.copy(
      scanlines,
      row * (stride + 1) + 1,
      row * stride,
      (row + 1) * stride
    );
  }
  return Buffer.concat([
    png.subarray(0, 8),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
