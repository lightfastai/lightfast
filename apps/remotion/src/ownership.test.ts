import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { ReactElement } from "react";
import { BRAND_COMPOSITIONS, BRAND_ICO } from "./brand-manifest";
import {
  type CompositionEntry,
  type CompositionManifest,
  enableCssLoaders,
  getStills,
  getVideos,
  MANIFEST,
  RemotionRoot,
} from "./remotion";

const appDir = fileURLToPath(new URL("..", import.meta.url));
const preservation = JSON.parse(
  readFileSync(new URL("./preservation.json", import.meta.url), "utf8")
) as { manifestSha256: string; files: Record<string, string> };
const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

test("retains every historical source file and static asset byte", () => {
  const files = ["src/remotion", "public"].flatMap((dir) =>
    readdirSync(path.join(appDir, dir), {
      recursive: true,
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile())
      .map((entry) =>
        path
          .relative(appDir, path.join(entry.parentPath, entry.name))
          .split(path.sep)
          .join("/")
      )
  );
  assert.deepEqual(files.sort(), Object.keys(preservation.files).sort());
  for (const [file, expected] of Object.entries(preservation.files)) {
    let contents = readFileSync(path.join(appDir, file), "utf8");
    // Only these assembly additions are intentional. Preserve the original fixture.
    if (file === "src/remotion/Root.tsx") {
      contents = contents
        .replace('import { BrandIcon, BrandPreview } from "../brand";\n', "")
        .replace("  BrandIcon,\n  BrandPreview,\n", "");
    } else if (file === "src/remotion/manifest.ts") {
      contents = contents
        .replace(
          'import { BRAND_COMPOSITIONS, BRAND_ICO } from "../brand-manifest";\n',
          ""
        )
        .replace("    ...BRAND_COMPOSITIONS,\n", "")
        .replace("postProcess: [BRAND_ICO]", "postProcess: []");
    } else {
      assert.equal(
        sha256(readFileSync(path.join(appDir, file))),
        expected,
        file
      );
      continue;
    }
    assert.equal(sha256(contents), expected, file);
  }
});

test("retains the complete manifest and local output contracts", () => {
  const manifest: CompositionManifest = MANIFEST;
  const historicalManifest = {
    compositions: Object.fromEntries(
      Object.entries(manifest.compositions).filter(
        ([id]) => !(id in BRAND_COMPOSITIONS)
      )
    ),
    postProcess: [],
  };
  assert.equal(
    sha256(JSON.stringify(historicalManifest)),
    preservation.manifestSha256
  );
  assert.equal(getStills().length, 28 + Object.keys(BRAND_COMPOSITIONS).length);
  assert.equal(getVideos().length, 1);
  const outDir = path.resolve(appDir, "out");
  const repoDir = path.resolve(appDir, "../..");
  for (const [id, entry] of Object.entries(manifest.compositions)) {
    for (const output of entry.outputs) {
      const dest = path.resolve(
        repoDir,
        output.dest,
        output.filename ?? `${id}.${output.format}`
      );
      assert.ok(dest.startsWith(`${outDir}${path.sep}`), dest);
    }
  }
  assert.deepEqual(manifest.postProcess, [BRAND_ICO]);
  for (const pp of manifest.postProcess) {
    for (const dest of pp.dests) {
      assert.ok(
        path
          .resolve(repoDir, dest, pp.filename)
          .startsWith(`${outDir}${path.sep}`)
      );
    }
  }
  const video = getVideos()[0]![1];
  assert.deepEqual(
    video.renderProfile.ffmpegOverride!({
      type: "pre-stitcher",
      args: ["-color_range", "tv", "scale=in_range=limited", "unchanged"],
    }),
    ["-color_range", "pc", "scale=in_range=full", "unchanged"]
  );
});

test("registers every manifest entry with the same dimensions, timing and props", () => {
  const children = RemotionRoot().props.children as ReactElement<
    Record<string, unknown>
  >[];
  const entries = Object.entries(MANIFEST.compositions) as [
    string,
    CompositionEntry,
  ][];
  assert.equal(children.length, entries.length);
  for (const [index, [id, entry]] of entries.entries()) {
    const { props } = children[index]!;
    assert.equal(props.id, id);
    assert.equal(props.width, entry.width);
    assert.equal(props.height, entry.height);
    assert.equal(typeof props.component, "function");
    assert.equal(props.schema, undefined);
    if (entry.type === "video") {
      assert.equal(props.fps, entry.fps);
      assert.equal(props.durationInFrames, entry.durationInFrames);
      assert.equal(props.defaultProps, undefined);
    } else {
      assert.deepEqual(props.defaultProps, entry.props);
    }
  }
});

test("keeps one CSS loader override with the same rule replacement behavior", async () => {
  const otherRule = { test: /\.tsx$/, use: ["other-loader"] };
  const output = await enableCssLoaders({
    module: { rules: [{ test: /\.css$/ }, otherRule] },
  });
  assert.deepEqual(output.module?.rules, [
    otherRule,
    {
      test: /\.css$/i,
      use: [
        "style-loader",
        "css-loader",
        {
          loader: "postcss-loader",
          options: {
            postcssOptions: { plugins: { "@tailwindcss/postcss": {} } },
          },
        },
      ],
    },
  ]);
});
