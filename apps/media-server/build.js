// Simple build script using esbuild CLI
import { execSync } from "child_process";
import fs from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure dist directory exists
if (!fs.existsSync(join(__dirname, "dist"))) {
  fs.mkdirSync(join(__dirname, "dist"), { recursive: true });
}

// Run esbuild directly
console.log("Building server with esbuild...");
try {
  execSync(
    "npx esbuild src/server.ts --bundle --platform=node --format=esm --outfile=dist/server.js --external:aws-sdk",
    { stdio: "inherit" },
  );
  console.log("Build completed successfully!");
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
