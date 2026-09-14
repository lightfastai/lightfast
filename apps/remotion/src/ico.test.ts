import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { crc32, inflateSync } from "node:zlib";
import { verifyFaviconIco } from "./brand-files";
import { buildIco } from "./ico";
import { decodePngPixels, rgbaPixels, toRgbaPng } from "./png-codec";

const sizes = [16, 32, 48];
// Canonical Chromium RGB renders from PR #1151; retain their original bytes.
const originals = sizes.map((size) =>
  readFileSync(new URL(`./fixtures/icon-${size}-rgb.png`, import.meta.url))
);

test("ICO frames are native-size RGBA PNGs with valid CRCs and unchanged pixels", () => {
  const ico = buildIco(originals);
  verifyFaviconIco(ico, originals);
  for (const [index, original] of originals.entries()) {
    assert.equal(original[25], 2, "regression fixture is RGB");
    const offset = ico.readUInt32LE(6 + index * 16 + 12);
    const length = ico.readUInt32LE(6 + index * 16 + 8);
    const png = ico.subarray(offset, offset + length);
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.readUInt32BE(16), sizes[index]);
    assert.equal(png.readUInt32BE(20), sizes[index]);
    assert.deepEqual([...png.subarray(24, 29)], [8, 6, 0, 0, 0]);
    const chunks: string[] = [];
    const idat: Buffer[] = [];
    for (let position = 8; position < png.length; ) {
      const bytes = png.readUInt32BE(position);
      const type = png.toString("ascii", position + 4, position + 8);
      chunks.push(type);
      assert.equal(
        png.readUInt32BE(position + bytes + 8),
        crc32(png.subarray(position + 4, position + bytes + 8))
      );
      if (type === "IDAT") {
        idat.push(png.subarray(position + 8, position + bytes + 8));
      }
      position += bytes + 12;
    }
    assert.deepEqual(chunks, ["IHDR", "IDAT", "IEND"]);
    const raw = inflateSync(Buffer.concat(idat));
    const { pixels, width, height } = decodePngPixels(original);
    assert.equal(raw.length, (width * 4 + 1) * height);
    for (let y = 0; y < height; y++) {
      assert.equal(raw[y * (width * 4 + 1)], 0);
      for (let x = 0; x < width; x++) {
        const target = y * (width * 4 + 1) + 1 + x * 4;
        const source = (y * width + x) * 3;
        assert.deepEqual(
          raw.subarray(target, target + 3),
          pixels.subarray(source, source + 3)
        );
        assert.equal(raw[target + 3], 255);
      }
    }
  }
});

test("RGBA encoding preserves an already RGBA image and ICO verification rejects RGB frames", () => {
  const rgba = toRgbaPng(originals[0]!);
  assert.deepEqual(rgbaPixels(toRgbaPng(rgba)), rgbaPixels(rgba));
  const ico = buildIco(originals);
  const offset = ico.readUInt32LE(18);
  ico[offset + 25] = 2;
  assert.throws(() => verifyFaviconIco(ico, originals), /must be RGBA/);
});
