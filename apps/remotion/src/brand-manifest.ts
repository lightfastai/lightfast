import { getBrandDimensions } from "./brand";
import type { CompositionEntry } from "./remotion/manifest";

const BRAND_DEST = "apps/remotion/out/brand-assets";
export const BRAND_ICONS = [
  [16, "icon-16.png"],
  [32, "icon-32.png"],
  [48, "icon-48.png"],
  [180, "apple-icon.png"],
  [192, "icon-192.png"],
  [512, "icon-512.png"],
  [1024, "icon-1024.png"],
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
  ...Object.fromEntries(
    [false, true].flatMap((lockup) =>
      [false, true].map((inverse) => {
        const kind = lockup ? "logo" : "icon";
        const suffix = inverse ? "-white" : "";
        const dimensions = getBrandDimensions(lockup);
        return [
          `brand-${kind}${suffix}`,
          {
            type: "still" as const,
            component: "BrandSvg",
            width: Math.ceil(dimensions.width),
            height: Math.ceil(dimensions.height),
            props: { lockup, inverse },
            outputs: [
              {
                format: "svg" as const,
                dest: BRAND_DEST,
                filename: `${kind}${suffix}.svg`,
              },
            ],
          },
        ];
      })
    )
  ),
};

export const BRAND_ICO = {
  type: "ico" as const,
  sources: ["brand-icon-16", "brand-icon-32", "brand-icon-48"],
  filename: "favicon.ico",
  dests: [BRAND_DEST],
};
