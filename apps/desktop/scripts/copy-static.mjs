import { cp, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const packageRoot = resolve(import.meta.dirname, "..");
const output = resolve(packageRoot, "dist/renderer");

await mkdir(output, { recursive: true });
await cp(resolve(packageRoot, "src/renderer"), output, { recursive: true });
