import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { DOT_MATRIX_PATH, WORDMARK_PATH } from "@repo/ui/components/brand/logo";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandSvg } from "./brand";
import { BRAND_ICONS } from "./brand-manifest";
import { decodePngPixels, verifyIconPixels } from "./verify-icon-pixels";
import { buildZip } from "./zip";

export const BRAND_VECTORS = [
  { filename: "lightfast-symbol-black.svg", lockup: false, inverse: false },
  { filename: "lightfast-symbol-white.svg", lockup: false, inverse: true },
  { filename: "lightfast-logo-black.svg", lockup: true, inverse: false },
  { filename: "lightfast-logo-white.svg", lockup: true, inverse: true },
] as const;

const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

export async function writeBrandVectors(directory: string) {
  await fs.mkdir(directory, { recursive: true });
  for (const { filename, ...props } of BRAND_VECTORS) {
    await fs.writeFile(
      path.join(directory, filename),
      `${renderToStaticMarkup(<BrandSvg {...props} />)}\n`
    );
  }
}

export async function getBrandPreviewProps(directory: string) {
  const dataUri = async (filename: string, mime: string) =>
    `data:${mime};base64,${(await fs.readFile(path.join(directory, filename))).toString("base64")}`;
  return {
    icons: await Promise.all(
      BRAND_ICONS.map(async ([size, filename]) => ({
        size,
        filename,
        src: await dataUri(filename, "image/png"),
      }))
    ),
    vectors: await Promise.all(
      BRAND_VECTORS.map(async ({ filename, inverse }) => ({
        filename,
        inverse,
        src: await dataUri(filename, "image/svg+xml"),
      }))
    ),
  };
}

export function verifyPng(png: Buffer, width: number, height = width) {
  assert.equal(
    png.subarray(0, 8).toString("hex"),
    "89504e470d0a1a0a",
    "PNG signature"
  );
  assert.equal(png.toString("ascii", 12, 16), "IHDR");
  assert.equal(png.readUInt32BE(16), width, "PNG width");
  assert.equal(png.readUInt32BE(20), height, "PNG height");
}

export async function verifyBrandPack(directory: string) {
  for (const [size, filename] of BRAND_ICONS) {
    const png = await fs.readFile(path.join(directory, filename));
    verifyPng(png, size);
    verifyIconPixels(png, size);
  }
  const preview = await fs.readFile(path.join(directory, "preview.png"));
  verifyPng(preview, 1040, 1000);
  verifyPreviewPixels(preview);
  for (const { filename, lockup, inverse } of BRAND_VECTORS) {
    const actual = await fs.readFile(path.join(directory, filename), "utf8");
    assert.equal(
      actual,
      `${renderToStaticMarkup(<BrandSvg inverse={inverse} lockup={lockup} />)}\n`,
      filename
    );
  }
  const ico = await fs.readFile(path.join(directory, "favicon.ico"));
  assert.equal(ico.readUInt32LE(0), 65_536, "ICO header");
  assert.equal(ico.readUInt16LE(4), 3, "ICO frame count");
  let expectedOffset = 54;
  for (const [index, [size, filename]] of BRAND_ICONS.slice(0, 3).entries()) {
    const entry = 6 + 16 * index;
    assert.equal(ico[entry], size);
    assert.equal(ico[entry + 1], size);
    assert.equal(ico.readUInt16LE(entry + 4), 1);
    assert.equal(ico.readUInt16LE(entry + 6), 32);
    const length = ico.readUInt32LE(entry + 8);
    assert.equal(ico.readUInt32LE(entry + 12), expectedOffset);
    const png = await fs.readFile(path.join(directory, filename));
    assert.deepEqual(
      ico.subarray(expectedOffset, expectedOffset + length),
      png,
      filename
    );
    expectedOffset += length;
  }
  assert.equal(ico.length, expectedOffset, "ICO has no trailing data");
}

export function verifyPreviewPixels(png: Buffer) {
  const { pixels, channels, width, height } = decodePngPixels(png);
  let darkPixels = 0;
  for (
    let pixel = Math.floor(height / 2) * width;
    pixel < width * height;
    pixel++
  ) {
    if (pixels[pixel * channels]! < 32) {
      darkPixels++;
    }
  }
  // White-vector panels have substantial black area; a missing-props title-only
  // preview must never pass verification merely because its IHDR is correct.
  assert.ok(darkPixels > 30_000, "preview contains the rendered asset panels");
}

export async function packageBrandPack(directory: string, repoRoot: string) {
  await verifyBrandPack(directory);
  const filenames = [
    ...BRAND_ICONS.map(([, filename]) => filename),
    ...BRAND_VECTORS.map(({ filename }) => filename),
    "favicon.ico",
    "preview.png",
  ].sort();
  const assets = await Promise.all(
    filenames.map(async (filename) => {
      const bytes = await fs.readFile(path.join(directory, filename));
      return { filename, bytes: bytes.length, sha256: sha256(bytes) };
    })
  );
  const receipt = {
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim(),
    source: "packages/ui/src/components/brand/logo.tsx",
    sourceTreeDirty:
      execFileSync(
        "git",
        ["status", "--porcelain", "--untracked-files=normal"],
        { cwd: repoRoot, encoding: "utf8" }
      ).trim().length > 0,
    geometry: {
      symbolSha256: sha256(DOT_MATRIX_PATH),
      wordmarkSha256: sha256(WORDMARK_PATH),
      clearspace: "3L (36 units around an 80-unit mark)",
    },
    command: "pnpm --filter @lightfast/remotion render:brand",
    assets,
  };
  await fs.writeFile(
    path.join(directory, "manifest.json"),
    `${JSON.stringify(receipt, null, 2)}\n`
  );
  await fs.writeFile(
    path.join(directory, "README.txt"),
    [
      "Lightfast dotted public asset pack",
      "",
      "Generated from the canonical @repo/ui paths; black/white vectors are transparent.",
      "PNG icons use a black symbol on an opaque white square. All retain 3L clearspace.",
      "favicon.ico contains the exact 16, 32 and 48px PNGs; Apple is 180px; Android is 192/512px.",
      "Android icons are ordinary icons, not maskable. No web manifest or website configuration is supplied.",
      "Full lockup is the default public logo; symbol alone is for compact icon/favicon use.",
      "White vectors require a contrasting dark background. Do not recolor, distort or crop away clearspace.",
      "At 16px the original dots are subpixel and visibly antialiased; no optical variant is included.",
      "preview.png embeds actual output files, with native small icons and pixelated enlargements.",
      "manifest.json records source commit, geometry and SHA-256 checksums for each asset.",
      "Regenerate: pnpm --filter @lightfast/remotion render:brand",
      "Guidance: https://lightfast.ai/brand",
      "Website rollout belongs to lightfastai/www and requires a separate follow-up. Nothing is deployed.",
      "",
    ].join("\n")
  );
  const entries = await Promise.all(
    [...filenames, "manifest.json", "README.txt"]
      .sort()
      .map(async (filename) => ({
        filename,
        bytes: await fs.readFile(path.join(directory, filename)),
      }))
  );
  await fs.writeFile(
    path.join(directory, "lightfast-brand-pack.zip"),
    buildZip(entries)
  );
}
