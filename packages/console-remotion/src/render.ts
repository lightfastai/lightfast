import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { LANDING_HERO_GIF_RENDER_PROFILE } from "./compositions/landing-hero";
import { enableCssLoaders } from "./webpack-override";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const startedAt = Date.now();
  const entryPoint = path.resolve(__dirname, "index.ts");
  const outputPath = path.resolve(
    __dirname,
    "../../../apps/www/public/images/landing-hero.gif",
  );
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  console.log("Bundling composition...");
  const bundled = await bundle({
    entryPoint,
    // Use the public directory for static assets (fonts)
    publicDir: path.resolve(__dirname, "../public"),
    webpackOverride: enableCssLoaders,
  });

  console.log("Selecting composition...");
  const composition = await selectComposition({
    serveUrl: bundled,
    id: "landing-hero",
  });

  console.log(`Rendering ${composition.width}x${composition.height} @ ${composition.fps}fps...`);
  console.log(
    `GIF profile: ${LANDING_HERO_GIF_RENDER_PROFILE.scale}x scale, ${Math.round(composition.fps / LANDING_HERO_GIF_RENDER_PROFILE.everyNthFrame)}fps output, ${LANDING_HERO_GIF_RENDER_PROFILE.imageFormat} intermediates`,
  );
  await renderMedia({
    composition,
    serveUrl: bundled,
    outputLocation: outputPath,
<<<<<<< Updated upstream
    ...LANDING_HERO_GIF_RENDER_PROFILE,
=======
    scale: 1, // Render at 2× resolution (2400×1600)
    everyNthFrame: 4, // 15fps GIF (30fps source / 2)
    numberOfGifLoops: null, // Infinite loop
>>>>>>> Stashed changes
  });

  console.log(`GIF rendered to: ${outputPath} in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
