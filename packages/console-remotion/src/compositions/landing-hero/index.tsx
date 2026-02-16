import type { RenderMediaOptions } from "@remotion/renderer";

export { LandingHero } from "./LandingHero";

/**
 * Balanced preset for high-quality GIF output:
 * - PNG intermediates prevent JPEG artifacts around text and line edges.
 * - 2x scale improves anti-aliasing for isometric geometry and typography.
 * - 15fps keeps motion smooth while controlling GIF size and render time.
 */
export const LANDING_HERO_GIF_RENDER_PROFILE = {
  codec: "gif",
  imageFormat: "png",
  scale: 2,
  everyNthFrame: 2,
  numberOfGifLoops: null,
} as const satisfies Pick<
  RenderMediaOptions,
  | "codec"
  | "imageFormat"
  | "scale"
  | "everyNthFrame"
  | "numberOfGifLoops"
>;
