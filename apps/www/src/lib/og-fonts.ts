import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const mediumFontPath = resolve(
  process.cwd(),
  "../../packages/ui-v2/public/fonts/pp-neue-montreal/PPNeueMontreal-Medium.woff"
);

export async function loadOGFonts() {
  const medium = await readFile(mediumFontPath);

  return [
    {
      name: "PP Neue Montreal",
      data: medium,
      weight: 500 as const,
      style: "normal" as const,
    },
  ];
}
