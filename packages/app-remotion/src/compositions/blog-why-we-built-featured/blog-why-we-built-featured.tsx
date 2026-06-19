import { Logo as BrandLogo } from "@repo/ui-v2/components/brand/logo";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  staticFile,
} from "@vendor/remotion";
import { loadFont } from "@vendor/remotion/fonts";
import type React from "react";
import { useEffect, useState } from "react";

const CANVAS_W = 1200;
const CANVAS_H = 675;

const PAPER_W = 1512;
const PAPER_H = 982;
const BACKGROUND_ZOOM = 1;
const BACKGROUND_SCALE =
  Math.max(CANVAS_W / PAPER_W, CANVAS_H / PAPER_H) * BACKGROUND_ZOOM;

const BRAND_SCALE = 1;

let brandFontsLoaded = false;

async function ensureBrandFontsLoaded() {
  if (brandFontsLoaded) {
    return;
  }

  await loadFont({
    family: "Roobert-TRIAL-Medium",
    url: staticFile("fonts/roobert/Roobert-TRIAL-Medium.woff2"),
    weight: "500",
  });

  brandFontsLoaded = true;
}

function WorkBackground() {
  return (
    <>
      <AbsoluteFill style={{ backgroundColor: "#14120B" }} />
      <div
        style={{
          height: PAPER_H,
          left: "50%",
          overflow: "hidden",
          position: "absolute",
          top: "50%",
          transform: `translate(-50%, -50%) scale(${BACKGROUND_SCALE})`,
          transformOrigin: "center",
          width: PAPER_W,
        }}
      >
        <img
          alt=""
          src={staticFile("images/remotion/webgl-background-work-preset.png")}
          style={{
            height: "100%",
            objectFit: "cover",
            width: "100%",
          }}
        />

        <div
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.34)",
            height: "100%",
            position: "absolute",
            width: "100%",
          }}
        />
      </div>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(circle at center, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0) 34%, rgba(0, 0, 0, 0.5) 100%)",
        }}
      />
    </>
  );
}

function CenterBrand() {
  return (
    <div
      style={{
        color: "#EDECEC",
        filter: "drop-shadow(0 0 36px rgba(237, 236, 236, 0.18))",
        left: "50%",
        position: "absolute",
        top: "50%",
        transform: `translate(-50%, -50%) scale(${BRAND_SCALE})`,
        transformOrigin: "center",
      }}
    >
      <BrandLogo className="text-current" showWordmark size="xl" />
    </div>
  );
}

export const BlogWhyWeBuiltFeatured: React.FC = () => {
  const [handle] = useState(() => delayRender("Loading brand fonts"));

  useEffect(() => {
    void ensureBrandFontsLoaded()
      .then(() => continueRender(handle))
      .catch((err: unknown) => {
        console.error("Brand font loading failed:", err);
        continueRender(handle);
      });
  }, [handle]);

  return (
    <AbsoluteFill>
      <WorkBackground />
      <CenterBrand />
    </AbsoluteFill>
  );
};
