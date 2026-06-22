import {
  Logo as BrandLogo,
  type LogoProps as BrandLogoProps,
} from "@repo/ui-v2/components/brand/logo";
import {
  AbsoluteFill,
  useVideoConfig,
} from "@vendor/remotion";
import type React from "react";

interface LogoProps {
  assetScale?: number;
  showWordmark?: boolean;
  size?: NonNullable<BrandLogoProps["size"]>;
}

export const Logo: React.FC<LogoProps> = ({
  assetScale = 1,
  showWordmark,
  size = "xl",
}) => {
  const { width, height } = useVideoConfig();
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
