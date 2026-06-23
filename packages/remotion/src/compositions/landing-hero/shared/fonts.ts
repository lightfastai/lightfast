import { staticFile } from "@vendor/remotion";
import { loadFont } from "@vendor/remotion/fonts";

let fontsLoaded = false;

const FONT_FAMILY = "Geist";

export const ensureFontsLoaded = async () => {
  if (fontsLoaded) {
    return;
  }

  await Promise.all([
    loadFont({
      family: FONT_FAMILY,
      url: staticFile("fonts/geist/Geist-Variable.woff2"),
      weight: "100 900",
    }),
  ]);

  fontsLoaded = true;
};
