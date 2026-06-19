import {
  Logo as BrandLogo,
  type LogoProps as BrandLogoProps,
} from "@repo/ui-v2/components/brand/logo";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  staticFile,
  useVideoConfig,
} from "@vendor/remotion";
import { loadFont } from "@vendor/remotion/fonts";
import type React from "react";
import { useEffect, useState } from "react";

interface LogoProps {
  assetScale?: number;
  showWordmark?: boolean;
  size?: NonNullable<BrandLogoProps["size"]>;
}

let fontsLoaded = false;

const ensureLogoFontsLoaded = async () => {
  if (fontsLoaded) {
    return;
  }

  await loadFont({
    family: "Roobert-TRIAL-Medium",
    url: staticFile("fonts/roobert/Roobert-TRIAL-Medium.woff2"),
    weight: "500",
  });

  fontsLoaded = true;
};

export const Logo: React.FC<LogoProps> = ({
  assetScale = 1,
  showWordmark,
  size = "xl",
}) => {
  const { width, height } = useVideoConfig();
  const [handle] = useState(() => delayRender("Loading logo fonts"));

  useEffect(() => {
    void ensureLogoFontsLoaded()
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);

  const shouldShowWordmark = showWordmark ?? width / height >= 2.25;

  return (
    <AbsoluteFill className="bg-background text-foreground">
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ transform: `scale(${assetScale})` }}
      >
        <BrandLogo
          className="text-current"
          showWordmark={shouldShowWordmark}
          size={size}
        />
      </div>
    </AbsoluteFill>
  );
};
