import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import {
  LANDING_HERO_POSTER_FRAME,
  LANDING_HERO_WEBM_RENDER_PROFILE,
} from "./compositions/landing-hero";
import { enableCssLoaders } from "./webpack-override";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const startedAt = Date.now();
  const entryPoint = path.resolve(__dirname, "index.ts");
  const outputDir = path.resolve(__dirname, "../../../apps/www/public/images");
  const webmOutputPath = path.resolve(outputDir, "landing-hero.webm");
  const posterOutputPath = path.resolve(outputDir, "landing-hero-poster.jpg");
  await fs.mkdir(outputDir, { recursive: true });

  console.log("Bundling composition...");
  const bundled = await bundle({
    entryPoint,
    publicDir: path.resolve(__dirname, "../public"),
    webpackOverride: enableCssLoaders,
  });

  console.log("Selecting composition...");
  const composition = await selectComposition({
    serveUrl: bundled,
    id: "landing-hero",
  });

  console.log(`Rendering poster still (frame ${LANDING_HERO_POSTER_FRAME})...`);
  await renderStill({
    composition,
    serveUrl: bundled,
    output: posterOutputPath,
    frame: LANDING_HERO_POSTER_FRAME,
    imageFormat: "jpeg",
    jpegQuality: 85,
    scale: 1,
    overwrite: true,
  });
  console.log(`Poster rendered to: ${posterOutputPath}`);

  console.log(
    `Rendering ${composition.width}x${composition.height} @ ${composition.fps}fps as WebM...`,
  );
  await renderMedia({
    composition,
    serveUrl: bundled,
    outputLocation: webmOutputPath,
    ...LANDING_HERO_WEBM_RENDER_PROFILE,
  });

  console.log(
    `WebM rendered to: ${webmOutputPath} in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
