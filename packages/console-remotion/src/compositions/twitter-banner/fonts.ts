import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

let fontsLoaded = false;

export const ensureFontsLoaded = async () => {
  if (fontsLoaded) return;

  await Promise.all([
    loadFont({
      family: "PP Neue Montreal",
      url: staticFile("fonts/PPNeueMontreal-Bold.woff2"),
      weight: "100 900",
    }),
    loadFont({
      family: "Geist",
      url: staticFile("fonts/Geist-Medium.woff2"),
      weight: "500",
    }),
  ]);

  fontsLoaded = true;
};
