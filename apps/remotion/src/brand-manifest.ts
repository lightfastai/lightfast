import type { CompositionEntry } from "./remotion/manifest";

export const BRAND_DEST = "apps/remotion/out/brand-pack";
export const BRAND_ICONS = [
  [16, "favicon-16x16.png"],
  [32, "favicon-32x32.png"],
  [48, "favicon-48x48.png"],
  [180, "apple-touch-icon.png"],
  [192, "android-chrome-192x192.png"],
  [512, "android-chrome-512x512.png"],
  [1024, "lightfast-symbol-1024.png"],
] as const;

export const BRAND_COMPOSITIONS: Record<string, CompositionEntry> = {
  ...Object.fromEntries(
    BRAND_ICONS.map(([size, filename]) => [
      `brand-icon-${size}`,
      {
        type: "still" as const,
        component: "BrandIcon",
        width: size,
        height: size,
        outputs: [{ format: "png" as const, dest: BRAND_DEST, filename }],
      },
    ])
  ),
  "brand-preview": {
    type: "still",
    component: "BrandPreview",
    width: 1040,
    height: 1000,
    outputs: [{ format: "png", dest: BRAND_DEST, filename: "preview.png" }],
  },
};

export const BRAND_ICO = {
  type: "ico" as const,
  sources: ["brand-icon-16", "brand-icon-32", "brand-icon-48"],
  filename: "favicon.ico",
  dests: [BRAND_DEST],
};
