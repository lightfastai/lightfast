import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

let fontsLoaded = false;

export const FONT_FAMILY = "PP Neue Montreal";

export const ensureFontsLoaded = async () => {
  if (fontsLoaded) return;

  await Promise.all([
    loadFont({
      family: FONT_FAMILY,
      url: staticFile("fonts/PPNeueMontreal-Book.woff2"),
      weight: "400",
    }),
    loadFont({
      family: FONT_FAMILY,
      url: staticFile("fonts/PPNeueMontreal-Medium.woff2"),
      weight: "500",
    }),
  ]);

  fontsLoaded = true;
};
