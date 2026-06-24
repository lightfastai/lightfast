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
  staticFile,
} from "@vendor/remotion";
import { loadFont } from "@vendor/remotion/fonts";
import type React from "react";
import { useEffect, useState } from "react";

type MarketingPanelKind = "title" | "wordmark";

interface MarketingPanelRenderProps {
  eyebrow?: string;
  kind?: MarketingPanelKind;
  title?: string;
}

let fontsLoaded = false;

const LOGO_METRICS = getLogoMetrics(LOGO_MARK_SIZES.lg);

function MarketingLogo() {
  return (
    <div
      style={{
        alignItems: "center",
        display: "flex",
        gap: LOGO_METRICS.gap,
      }}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        height={LOGO_METRICS.markSize}
        viewBox={`0 0 ${LOGO_MARK_VIEWBOX_SIZE} ${LOGO_MARK_VIEWBOX_SIZE}`}
        width={LOGO_METRICS.markSize}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={DOT_MATRIX_PATH} fill="currentColor" />
      </svg>
      <svg
        aria-label="Lightfast"
        focusable="false"
        height={LOGO_METRICS.wordmarkHeight}
        role="img"
        viewBox={WORDMARK_LOCKUP_VIEWBOX}
        width={LOGO_METRICS.wordmarkWidth}
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
  eyebrow = "Operating Thesis",
  kind = "title",
  title = "Collaboration between humans and machine",
}) => {
  const [handle] = useState(() => delayRender("Loading marketing panel fonts"));

  useEffect(() => {
    void ensureMarketingPanelFontsLoaded()
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);

  return (
    <AbsoluteFill className="bg-foreground text-background">
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
            <MarketingLogo />
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
