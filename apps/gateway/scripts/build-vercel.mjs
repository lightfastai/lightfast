import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(__dirname, "..");
const OUTPUT_DIR = join(APP_DIR, ".vercel/output");
const FUNC_DIR = join(OUTPUT_DIR, "functions/index.func");

async function main() {
  await mkdir(FUNC_DIR, { recursive: true });

  // Copy the tsup bundle (single self-contained file)
  await copyFile(join(APP_DIR, "dist/src/index.js"), join(FUNC_DIR, "index.js"));

  // Copy sourcemap if available
  const mapSrc = join(APP_DIR, "dist/src/index.js.map");
  if (existsSync(mapSrc)) {
    await copyFile(mapSrc, join(FUNC_DIR, "index.js.map"));
  }

  // Function config — no filePathMap needed (everything is bundled)
  await writeFile(
    join(FUNC_DIR, ".vc-config.json"),
    JSON.stringify(
      {
        runtime: "nodejs22.x",
        handler: "index.js",
        launcherType: "Nodejs",
        shouldAddHelpers: false,
        shouldAddSourcemapSupport: true,
      },
      null,
      2,
    ),
  );

  // Routing — catch-all to the single function
  await writeFile(
    join(OUTPUT_DIR, "config.json"),
    JSON.stringify(
      {
        version: 3,
        routes: [{ src: "/(.*)", dest: "/index" }],
      },
      null,
      2,
    ),
  );

  console.log("[build-vercel] .vercel/output/ generated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
