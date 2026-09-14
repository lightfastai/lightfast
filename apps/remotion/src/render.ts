import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@vendor/remotion/bundler";
import {
  renderMedia,
  renderStill,
  selectComposition,
} from "@vendor/remotion/renderer";
import {
  renderBrandSvg,
  verifyBrandFile,
  verifyFaviconIco,
  writeBrandReceipt,
} from "./brand-files";
import { BRAND_COMPOSITIONS } from "./brand-manifest";
import { buildIco } from "./ico";
import { enableCssLoaders, getStills, getVideos, MANIFEST } from "./remotion";
import { selectRenderIds } from "./render-selection";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../.."); // monorepo root
const REMOTION_PUBLIC_DIR = path.resolve(ROOT, "apps/remotion/public");

/** Resolve a manifest dest path to an absolute path */
function resolveDest(dest: string, filename: string): string {
  return path.resolve(ROOT, dest, filename);
}

/** Copy a rendered file to all its declared destinations */
async function distribute(
  sourcePath: string,
  outputs: Array<{ dest: string; filename?: string }>,
  defaultFilename: string
) {
  for (const output of outputs) {
    const destPath = resolveDest(
      output.dest,
      output.filename ?? defaultFilename
    );
    await fs.mkdir(path.dirname(destPath), { recursive: true });
    if (destPath !== sourcePath) {
      await fs.copyFile(sourcePath, destPath);
    }
  }
}

// ── Filter support ───────────────────────────────────────────────────
// Usage: tsx src/render.ts [--only stills|video|brand|all] [--id composition-id]

async function main() {
  const selected = selectRenderIds(process.argv.slice(2));
  const startedAt = Date.now();
  const entryPoint = path.resolve(__dirname, "index.ts");
  const tmpDir = path.resolve(__dirname, "../.cache/render");
  await fs.mkdir(tmpDir, { recursive: true });
  const verifiedBrandFiles: string[] = [];

  console.log("Bundling compositions...");
  const bundled = await bundle({
    entryPoint,
    publicDir: REMOTION_PUBLIC_DIR,
    webpackOverride: enableCssLoaders,
  });
  for (const [id, entry] of getVideos()) {
    if (!selected.has(id)) {
      continue;
    }

    const composition = await selectComposition({ serveUrl: bundled, id });

    for (const output of entry.outputs) {
      const filename = output.filename ?? `${id}.${output.format}`;

      if (output.frame === undefined) {
        // Full video render
        const tmpPath = path.join(tmpDir, filename);
        console.log(
          `Rendering ${id} (${entry.width}×${entry.height} @ ${entry.fps}fps)...`
        );
        await renderMedia({
          composition,
          serveUrl: bundled,
          outputLocation: tmpPath,
          ...entry.renderProfile,
        });
        await distribute(tmpPath, [output], filename);
        console.log(`  ✔ ${filename} → ${output.dest}`);
      } else {
        // Still frame extraction from video
        const tmpPath = path.join(tmpDir, filename);
        console.log(`Rendering ${id} poster (frame ${output.frame})...`);
        await renderStill({
          composition,
          serveUrl: bundled,
          output: tmpPath,
          frame: output.frame,
          imageFormat: output.format as "webp" | "png",
          scale: output.scale ?? 1,
          overwrite: true,
        });
        await distribute(tmpPath, [output], filename);
        console.log(`  ✔ ${filename} → ${output.dest}`);
      }
    }
  }
  for (const [id, entry] of getStills()) {
    if (!selected.has(id)) {
      continue;
    }

    console.log(`Rendering ${id} (${entry.width}×${entry.height})...`);
    const composition = await selectComposition({
      serveUrl: bundled,
      id,
    });

    for (const output of entry.outputs) {
      const filename = output.filename ?? `${id}.${output.format}`;
      const tmpPath = path.join(tmpDir, filename);

      if (output.format === "svg") {
        if (entry.component !== "BrandSvg") {
          throw new Error(`SVG export is not supported for ${entry.component}`);
        }
        await fs.writeFile(tmpPath, renderBrandSvg(entry.props));
      } else {
        await renderStill({
          composition,
          serveUrl: bundled,
          output: tmpPath,
          imageFormat: output.format as "png" | "webp",
          scale: output.scale ?? 1,
          overwrite: true,
        });
      }
      await distribute(tmpPath, [output], filename);
      if (id in BRAND_COMPOSITIONS) {
        const destination = resolveDest(output.dest, filename);
        await verifyBrandFile(destination, entry);
        verifiedBrandFiles.push(destination);
      }
      console.log(`  ✔ ${filename} → ${output.dest}`);
    }
  }
  for (const pp of MANIFEST.postProcess) {
    if (!pp.sources.every((id) => selected.has(id))) {
      continue;
    }
    if (pp.type === "ico") {
      console.log(`Building ${pp.filename}...`);
      const pngBuffers = await Promise.all(
        pp.sources.map(async (sourceId) => {
          const entry = MANIFEST.compositions[sourceId];
          if (!entry || entry.type !== "still") {
            throw new Error(
              `ICO source "${sourceId}" is not a still composition`
            );
          }
          const output = entry.outputs[0]!;
          const filename = output.filename ?? `${sourceId}.png`;
          const filePath = path.join(tmpDir, filename);
          return fs.readFile(filePath);
        })
      );

      const icoBuffer = buildIco(pngBuffers);
      for (const dest of pp.dests) {
        const icoPath = resolveDest(dest, pp.filename);
        await fs.mkdir(path.dirname(icoPath), { recursive: true });
        await fs.writeFile(icoPath, icoBuffer);
        verifyFaviconIco(await fs.readFile(icoPath), pngBuffers);
        verifiedBrandFiles.push(icoPath);
      }
      console.log(`  ✔ ${pp.filename} → ${pp.dests.join(", ")}`);
    }
  }
  if (verifiedBrandFiles.length > 0) {
    await writeBrandReceipt(ROOT, verifiedBrandFiles);
    console.log(
      `  ✔ Verified ${verifiedBrandFiles.length} individual brand files`
    );
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const totalCompositions = selected.size;
  console.log(
    `\n${totalCompositions} compositions rendered + distributed in ${elapsed}s`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
