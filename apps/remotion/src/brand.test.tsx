import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DOT_MATRIX_PATH,
  getLogoMetrics,
  WORDMARK_LOCKUP_VIEWBOX,
  WORDMARK_PATH,
} from "@repo/ui/components/brand/logo";
import { renderToStaticMarkup } from "react-dom/server";
import { BRAND_CLEARSPACE, BrandSvg, getBrandDimensions } from "./brand";
import { BRAND_COMPOSITIONS, BRAND_ICO, BRAND_ICONS } from "./brand-manifest";
import { selectRenderIds } from "./render-selection";
import { buildZip } from "./zip";

test("public SVGs retain both canonical paths, lockup metrics and exact 3L clearspace", () => {
  assert.equal(BRAND_CLEARSPACE, 36);
  assert.deepEqual(getBrandDimensions(), { width: 152, height: 152 });
  const dots = [
    ...DOT_MATRIX_PATH.matchAll(/M(\d+) (\d+)a4 4 0 1 0-8 0 4 4 0 0 0 8 0/g),
  ];
  assert.equal(dots.length, 37);
  assert.equal(dots.map(([match]) => match).join(""), DOT_MATRIX_PATH);
  const metrics = getLogoMetrics(80);
  for (const lockup of [false, true]) {
    for (const inverse of [false, true]) {
      const svg = renderToStaticMarkup(
        <BrandSvg inverse={inverse} lockup={lockup} />
      );
      const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map(
        (match) => match[1]
      );
      assert.deepEqual(
        paths,
        lockup ? [DOT_MATRIX_PATH, WORDMARK_PATH] : [DOT_MATRIX_PATH]
      );
      assert.ok(svg.includes(`fill="${inverse ? "#ffffff" : "#000000"}"`));
      assert.ok(svg.includes('viewBox="0 0 80 80"'));
      assert.ok(svg.includes('x="36"'));
      assert.ok(
        !(
          svg.includes("<text") ||
          svg.includes("stroke=") ||
          svg.includes("<rect")
        )
      );
      if (lockup) {
        assert.ok(svg.includes(`viewBox="${WORDMARK_LOCKUP_VIEWBOX}"`));
        assert.ok(svg.includes(`x="${36 + 80 + metrics.gap}"`));
        assert.equal(
          getBrandDimensions(true).height,
          72 + metrics.wordmarkHeight
        );
      }
    }
  }
});

test("the focused pack selects all native sizes and fresh ICO dependencies without historical media", () => {
  const selected = selectRenderIds(["--pack", "brand"]);
  assert.deepEqual([...selected], Object.keys(BRAND_COMPOSITIONS));
  assert.deepEqual(
    BRAND_ICONS.map(([size]) => size),
    [16, 32, 48, 180, 192, 512, 1024]
  );
  assert.ok(BRAND_ICO.sources.every((id) => selected.has(id)));
  assert.ok(!(selected.has("landing-hero") || selected.has("logo-1024")));
  assert.deepEqual(selectRenderIds(["--id", "brand-preview"]), selected);
  const single = selectRenderIds(["--only", "stills", "--id", "brand-icon-16"]);
  assert.deepEqual([...single], ["brand-icon-16"]);
  assert.ok(!BRAND_ICO.sources.every((id) => single.has(id)));
  assert.deepEqual([...selectRenderIds(["--id", "logo-1024"])], ["logo-1024"]);
});

test("invalid render selections fail before bundling or writing", () => {
  for (const args of [
    ["--id", "missing"],
    ["--only", "videos"],
    ["--pack", "unknown"],
    ["--pack", "brand", "--id", "logo-1024"],
    ["--id"],
    ["--only", "video", "--id", "brand-icon-16"],
    ["--only", "all", "--only", "stills"],
  ]) {
    assert.throws(() => selectRenderIds(args));
  }
});

test("portable ZIP has fixed metadata and standard CRC-32", () => {
  const entries = [
    { filename: "fixture.txt", bytes: Buffer.from("123456789") },
  ];
  const zip = buildZip(entries);
  assert.deepEqual(buildZip(entries), zip);
  assert.equal(zip.readUInt32LE(0), 0x04_03_4b_50);
  assert.equal(zip.readUInt32LE(14), 0xcb_f4_39_26);
  assert.equal(zip.readUInt16LE(12), 33);
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06_05_4b_50);
  assert.equal(zip.readUInt16LE(zip.length - 12), 1);
});
