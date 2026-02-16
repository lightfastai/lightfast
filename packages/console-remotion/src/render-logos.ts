import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { LOGO_VARIANTS } from "./compositions/logo";
import { enableCssLoaders } from "./webpack-override";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Pack multiple PNG buffers into a single .ico file. */
function buildIco(pngs: Buffer[]): Buffer {
  const HEADER = 6; // reserved(2) + type(2) + count(2)
  const ENTRY = 16; // per-image directory entry
  const headerBuf = Buffer.alloc(HEADER + ENTRY * pngs.length);

  // ICO header
  headerBuf.writeUInt16LE(0, 0); // reserved
  headerBuf.writeUInt16LE(1, 2); // type = ICO
  headerBuf.writeUInt16LE(pngs.length, 4); // image count

  let dataOffset = HEADER + ENTRY * pngs.length;
  for (let i = 0; i < pngs.length; i++) {
    const png = pngs[i]!;
    // Read dimensions from PNG header (IHDR chunk at byte 16)
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    const off = HEADER + ENTRY * i;

    headerBuf.writeUInt8(w >= 256 ? 0 : w, off); // width (0 = 256)
    headerBuf.writeUInt8(h >= 256 ? 0 : h, off + 1); // height
    headerBuf.writeUInt8(0, off + 2); // color palette
    headerBuf.writeUInt8(0, off + 3); // reserved
    headerBuf.writeUInt16LE(1, off + 4); // color planes
    headerBuf.writeUInt16LE(32, off + 6); // bits per pixel
    headerBuf.writeUInt32LE(png.length, off + 8); // image size
    headerBuf.writeUInt32LE(dataOffset, off + 12); // data offset
    dataOffset += png.length;
  }

  return Buffer.concat([headerBuf, ...pngs]);
}

async function main() {
  const startedAt = Date.now();
  const entryPoint = path.resolve(__dirname, "index.ts");
  const outputDir = path.resolve(__dirname, "../out/logos");
  await fs.mkdir(outputDir, { recursive: true });

  console.log("Bundling compositions...");
  const bundled = await bundle({
    entryPoint,
    publicDir: path.resolve(__dirname, "../public"),
    webpackOverride: enableCssLoaders,
  });

  for (const variant of LOGO_VARIANTS) {
    console.log(
      `Rendering ${variant.id} (${variant.width}×${variant.height})...`,
    );
    const composition = await selectComposition({
      serveUrl: bundled,
      id: variant.id,
    });

    const outputPath = path.join(outputDir, variant.filename);
    await renderStill({
      composition,
      serveUrl: bundled,
      output: outputPath,
      imageFormat: "png",
    });
    console.log(`  → ${variant.filename}`);
  }

  // ── Build favicon.ico (16 + 32 + 48 bundled) ───────────
  const icoSizes = ["favicon-16x16.png", "favicon-32x32.png", "favicon-48x48.png"];
  const pngBuffers = await Promise.all(
    icoSizes.map((f) => fs.readFile(path.join(outputDir, f))),
  );

  const icoPath = path.join(outputDir, "favicon.ico");
  await fs.writeFile(icoPath, buildIco(pngBuffers));
  console.log(`  → favicon.ico (${icoSizes.length} sizes bundled)`);

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `\nAll ${LOGO_VARIANTS.length} variants + favicon.ico rendered in ${elapsed}s`,
  );
  console.log(`Output: ${outputDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
