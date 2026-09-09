import {
  DOT_MATRIX_PATH,
  getLogoMetrics,
  LOGO_MARK_SIZES,
  LOGO_MARK_VIEWBOX_SIZE,
  WORDMARK_LOCKUP_VIEWBOX,
  WORDMARK_PATH,
} from "@repo/ui-v2/components/brand/logo";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  Img,
  staticFile,
} from "@vendor/remotion";
import { loadFont } from "@vendor/remotion/fonts";
import type React from "react";
import { useEffect, useState } from "react";

type MarketingPanelKind = "title" | "wordmark";
type MarketingPanelBackground = "solid" | "halftone";

interface MarketingPanelRenderProps {
  background?: MarketingPanelBackground;
  eyebrow?: string;
  kind?: MarketingPanelKind;
  logoMarkSize?: number;
  title?: string;
}

let fontsLoaded = false;

function MarketingLogo({
  markSize = LOGO_MARK_SIZES.lg,
}: {
  markSize?: number;
}) {
  const logoMetrics = getLogoMetrics(markSize);

  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        gap: logoMetrics.gap,
      }}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        height={logoMetrics.markSize}
        viewBox={`0 0 ${LOGO_MARK_VIEWBOX_SIZE} ${LOGO_MARK_VIEWBOX_SIZE}`}
        width={logoMetrics.markSize}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={DOT_MATRIX_PATH} fill="currentColor" />
      </svg>
      <svg
        aria-label="Lightfast"
        focusable="false"
        height={logoMetrics.wordmarkHeight}
        role="img"
        viewBox={WORDMARK_LOCKUP_VIEWBOX}
        width={logoMetrics.wordmarkWidth}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={WORDMARK_PATH} fill="currentColor" />
      </svg>
    </div>
  );
}

const ensureMarketingPanelFontsLoaded = async () => {
  if (fontsLoaded) {
    return;
  }

  await Promise.all([
    loadFont({
      family: "Geist Variable",
      url: staticFile("fonts/geist/Geist-Variable.woff2"),
      weight: "100 900",
    }),
    loadFont({
      family: "PP Neue Montreal",
      url: staticFile("fonts/pp-neue-montreal/PPNeueMontreal-Medium.woff2"),
      weight: "500",
    }),
  ]);

  fontsLoaded = true;
};

export const MarketingPanelRender: React.FC<MarketingPanelRenderProps> = ({
  background = "solid",
  eyebrow = "Operating Thesis",
  kind = "title",
  logoMarkSize = LOGO_MARK_SIZES.lg,
  title = "Collaboration between humans and machine",
}) => {
  const [handle] = useState(() => delayRender("Loading marketing panel fonts"));

  useEffect(() => {
    void ensureMarketingPanelFontsLoaded()
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);

  const isHalftone = background === "halftone";

  return (
    <AbsoluteFill
      className={
        isHalftone ? "bg-muted text-white" : "bg-foreground text-background"
      }
    >
      {isHalftone ? (
        <AbsoluteFill>
          <Img
            alt=""
            className="h-full w-full object-cover"
            height={900}
            src={staticFile("images/landing-halftone-bg-q40.webp")}
            width={1440}
          />
        </AbsoluteFill>
      ) : null}
      <div className="relative h-full w-full px-28 py-16">
        <div className="grid grid-cols-3 items-start text-xs leading-none">
          <span />
          <span className="text-center">{eyebrow}</span>
          <span />
        </div>

        <div className="absolute inset-0 flex items-center justify-center text-center">
          {kind === "title" ? (
            <h1 className="max-w-xl font-medium font-title text-4xl tracking-normal">
              {title}
            </h1>
          ) : (
            <MarketingLogo markSize={logoMarkSize} />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
