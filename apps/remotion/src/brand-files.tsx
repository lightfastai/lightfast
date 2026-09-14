import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { DOT_MATRIX_PATH, WORDMARK_PATH } from "@repo/ui/components/brand/logo";
import { renderToStaticMarkup } from "react-dom/server";
import { BrandSvg } from "./brand";
import { rgbaPixels } from "./png-codec";
import type { CompositionEntry } from "./remotion/manifest";
import { verifyIconPixels } from "./verify-icon-pixels";

export function renderBrandSvg(props?: Record<string, unknown>) {
  const lockup = props?.lockup;
  const inverse = props?.inverse;
  if (typeof lockup !== "boolean" || typeof inverse !== "boolean") {
    throw new Error("Brand SVG exports require lockup and inverse booleans");
  }
  return `${renderToStaticMarkup(<BrandSvg inverse={inverse} lockup={lockup} />)}\n`;
}

export async function verifyBrandFile(
  filename: string,
  entry: CompositionEntry
) {
  const bytes = await fs.readFile(filename);
  if (entry.component === "BrandSvg") {
    assert.equal(entry.type, "still");
    assert.equal(
      bytes.toString("utf8"),
      renderBrandSvg(entry.type === "still" ? entry.props : undefined)
    );
    return;
  }
  assert.equal(
    bytes.subarray(0, 8).toString("hex"),
    "89504e470d0a1a0a",
    "PNG signature"
  );
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR");
  assert.equal(bytes.readUInt32BE(16), entry.width, "PNG width");
  assert.equal(bytes.readUInt32BE(20), entry.height, "PNG height");
  verifyIconPixels(bytes, entry.width);
}

export function verifyFaviconIco(ico: Buffer, pngs: Buffer[]) {
  assert.equal(ico.readUInt32LE(0), 65_536, "ICO header");
  assert.equal(ico.readUInt16LE(4), pngs.length, "ICO frame count");
  let expectedOffset = 6 + 16 * pngs.length;
  for (const [index, png] of pngs.entries()) {
    const entry = 6 + 16 * index;
    assert.equal(ico[entry], png.readUInt32BE(16));
    assert.equal(ico[entry + 1], png.readUInt32BE(20));
    assert.equal(ico.readUInt16LE(entry + 4), 1);
    assert.equal(ico.readUInt16LE(entry + 6), 32);
    const length = ico.readUInt32LE(entry + 8);
    assert.equal(ico.readUInt32LE(entry + 12), expectedOffset);
    const frame = ico.subarray(expectedOffset, expectedOffset + length);
    assert.equal(frame[25], 6, "ICO PNG frames must be RGBA for Next.js");
    assert.equal(frame.readUInt32BE(16), png.readUInt32BE(16));
    assert.equal(frame.readUInt32BE(20), png.readUInt32BE(20));
    assert.deepEqual(
      rgbaPixels(frame),
      rgbaPixels(png),
      "ICO preserves source pixels"
    );
    expectedOffset += length;
  }
  assert.equal(ico.length, expectedOffset, "ICO has no trailing data");
}

export async function writeBrandReceipt(repoRoot: string, files: string[]) {
  const sha256 = (value: string | Buffer) =>
    createHash("sha256").update(value).digest("hex");
  const receipt = {
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim(),
    sourceTreeDirty:
      execFileSync(
        "git",
        ["status", "--porcelain", "--untracked-files=normal"],
        { cwd: repoRoot, encoding: "utf8" }
      ).trim().length > 0,
    source: "packages/ui/src/components/brand/logo.tsx",
    geometry: {
      symbolSha256: sha256(DOT_MATRIX_PATH),
      wordmarkSha256: sha256(WORDMARK_PATH),
      clearspace: "3L (36 units around an 80-unit mark)",
    },
    files: await Promise.all(
      files.map(async (filename) => ({
        path: path.relative(repoRoot, filename),
        sha256: sha256(await fs.readFile(filename)),
      }))
    ),
  };
  await fs.writeFile(
    path.join(repoRoot, "apps/remotion/.cache/brand-render-receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`
  );
}
