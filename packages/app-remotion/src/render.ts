import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@vendor/remotion/bundler";
import {
  renderMedia,
  renderStill,
  selectComposition,
} from "@vendor/remotion/renderer";
import { getStills, getVideos, MANIFEST } from "./manifest";
import { enableCssLoaders } from "./webpack-override";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../.."); // monorepo root

/** Resolve a manifest dest path to an absolute path */
function resolveDest(dest: string, filename: string): string {
  return path.resolve(ROOT, dest, filename);
}

/** Pack multiple PNG buffers into a single .ico file */
function buildIco(pngs: Buffer[]): Buffer {
  const HEADER = 6;
  const ENTRY = 16;
  const headerBuf = Buffer.alloc(HEADER + ENTRY * pngs.length);
  headerBuf.writeUInt16LE(0, 0);
  headerBuf.writeUInt16LE(1, 2);
  headerBuf.writeUInt16LE(pngs.length, 4);

  let dataOffset = HEADER + ENTRY * pngs.length;
  for (let i = 0; i < pngs.length; i++) {
    const png = pngs[i]!;
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    const off = HEADER + ENTRY * i;
    headerBuf.writeUInt8(w >= 256 ? 0 : w, off);
    headerBuf.writeUInt8(h >= 256 ? 0 : h, off + 1);
    headerBuf.writeUInt8(0, off + 2);
    headerBuf.writeUInt8(0, off + 3);
    headerBuf.writeUInt16LE(1, off + 4);
    headerBuf.writeUInt16LE(32, off + 6);
    headerBuf.writeUInt32LE(png.length, off + 8);
    headerBuf.writeUInt32LE(dataOffset, off + 12);
    dataOffset += png.length;
  }
  return Buffer.concat([headerBuf, ...pngs]);
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
// Usage: npx tsx src/render.ts [--only stills|video|all] [--id composition-id]
const args = process.argv.slice(2);
const onlyFlag = args.includes("--only")
  ? args[args.indexOf("--only") + 1]
  : "all";
const idFlag = args.includes("--id")
  ? args[args.indexOf("--id") + 1]
  : undefined;

async function main() {
  const startedAt = Date.now();
  const entryPoint = path.resolve(__dirname, "index.ts");
  const tmpDir = path.resolve(__dirname, "../.cache/render");
  await fs.mkdir(tmpDir, { recursive: true });

  console.log("Bundling compositions...");
  const bundled = await bundle({
    entryPoint,
    publicDir: path.resolve(__dirname, "../public"),
    webpackOverride: enableCssLoaders,
  });

  // ── Render video compositions ──────────────────────────────────
  if (onlyFlag === "all" || onlyFlag === "video") {
    for (const [id, entry] of getVideos()) {
      if (idFlag && idFlag !== id) {
        continue;
      }

      const composition = await selectComposition({ serveUrl: bundled, id });

      for (const output of entry.outputs) {
        const filename = output.filename ?? `${id}.${output.format}`;

        if (output.frame !== undefined) {
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
        } else {
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
        }
      }
    }
  }

  // ── Render still compositions ──────────────────────────────────
  if (onlyFlag === "all" || onlyFlag === "stills") {
    for (const [id, entry] of getStills()) {
      if (idFlag && idFlag !== id) {
        continue;
      }

      console.log(`Rendering ${id} (${entry.width}×${entry.height})...`);
      const composition = await selectComposition({ serveUrl: bundled, id });

      // Render once to tmp, then distribute to all destinations
      const firstOutput = entry.outputs[0]!;
      const filename = firstOutput.filename ?? `${id}.${firstOutput.format}`;
      const tmpPath = path.join(tmpDir, filename);
      await renderStill({
        composition,
        serveUrl: bundled,
        output: tmpPath,
        imageFormat: firstOutput.format as "png" | "webp",
        scale: firstOutput.scale ?? 1,
        overwrite: true,
      });
      await distribute(tmpPath, entry.outputs, filename);
      const dests = [...new Set(entry.outputs.map((o) => o.dest))];
      console.log(`  ✔ ${filename} → ${dests.join(", ")}`);
    }
  }

  // ── Post-processing ────────────────────────────────────────────
  for (const pp of MANIFEST.postProcess) {
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
      }
      console.log(`  ✔ ${pp.filename} → ${pp.dests.join(", ")}`);
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  const totalCompositions = Object.keys(MANIFEST.compositions).length;
  console.log(
    `\n${totalCompositions} compositions rendered + distributed in ${elapsed}s`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
