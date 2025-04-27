import fs from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { build } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  try {
    console.log("Starting esbuild...");

    // Ensure dist directory exists
    if (!fs.existsSync(join(__dirname, "dist"))) {
      fs.mkdirSync(join(__dirname, "dist"), { recursive: true });
    }

    // Bundle the server
    const result = await build({
      entryPoints: [join(__dirname, "src/server.ts")],
      outfile: join(__dirname, "dist/server.js"),
      bundle: true,
      platform: "node",
      target: "node20",
      format: "esm",
      external: ["aws-sdk"],
      sourcemap: true,
    });

    console.log("Build successful:", result);
  } catch (err) {
    console.error("Build failed:", err);
    process.exit(1);
  }
}

main();
