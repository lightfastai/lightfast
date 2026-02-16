import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const entryPoint = path.resolve(__dirname, "index.ts");
  const outputPath = path.resolve(
    __dirname,
    "../../../apps/www/public/images/landing-hero.gif",
  );

  console.log("Bundling composition...");
  const bundled = await bundle({
    entryPoint,
    // Use the public directory for static assets (fonts)
    publicDir: path.resolve(__dirname, "../public"),
  });

  console.log("Selecting composition...");
  const composition = await selectComposition({
    serveUrl: bundled,
    id: "LandingHero",
  });

  console.log(`Rendering ${composition.width}x${composition.height} @ ${composition.fps}fps...`);
  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: "gif",
    outputLocation: outputPath,
    everyNthFrame: 2, // 15fps GIF (30fps source / 2)
    numberOfGifLoops: null, // Infinite loop
  });

  console.log(`GIF rendered to: ${outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
