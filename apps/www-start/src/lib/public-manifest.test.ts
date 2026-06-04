import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const publicRoot = path.resolve(process.cwd(), "public");
const manifestPath = path.join(publicRoot, "manifest.json");

interface WebManifestIcon {
  src: string;
  sizes: string;
  type: string;
}

interface WebManifest {
  background_color: string;
  description: string;
  display: string;
  icons: WebManifestIcon[];
  name: string;
  short_name: string;
  start_url: string;
  theme_color: string;
}

function readManifest(): WebManifest {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

describe("public manifest", () => {
  it("keeps install metadata and icon assets local to www-start", () => {
    const manifest = readManifest();

    expect(manifest).toMatchObject({
      name: "Lightfast - The Operating Layer for Agents and Apps",
      short_name: "Lightfast",
      start_url: "/",
      display: "standalone",
      background_color: "#09090b",
      theme_color: "#09090b",
    });

    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
        { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
        {
          src: "/android-chrome-192x192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/android-chrome-512x512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ])
    );

    for (const icon of manifest.icons) {
      expect(fs.existsSync(path.join(publicRoot, icon.src))).toBe(true);
    }
  });
});
