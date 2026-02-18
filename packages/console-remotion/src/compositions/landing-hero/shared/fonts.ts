import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

let fontsLoaded = false;

const FONT_FAMILY = "Geist";

export const ensureFontsLoaded = async () => {
  if (fontsLoaded) return;

  await Promise.all([
    loadFont({
      family: FONT_FAMILY,
      url: staticFile("fonts/Geist-Regular.woff2"),
      weight: "400",
    }),
    loadFont({
      family: FONT_FAMILY,
      url: staticFile("fonts/Geist-Medium.woff2"),
      weight: "500",
    }),
  ]);

  fontsLoaded = true;
};
