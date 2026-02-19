import type { RenderMediaOptions } from "@remotion/renderer";

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

/**
 * VP9/WebM preset for the landing hero video:
 * - VP9 produces 80-90% smaller output than GIF at equivalent quality.
 * - PNG intermediates preserve edge fidelity on isometric geometry.
 * - 2x scale matches GIF anti-aliasing quality.
 * - Full 30fps — no frame skipping needed unlike GIF.
 */
export const LANDING_HERO_WEBM_RENDER_PROFILE = {
  codec: "vp9",
  imageFormat: "png",
  scale: 2,
} as const satisfies Pick<RenderMediaOptions, "codec" | "imageFormat" | "scale">;

/** Frame used for the static poster image shown while the video loads. */
export const LANDING_HERO_POSTER_FRAME = 150;
