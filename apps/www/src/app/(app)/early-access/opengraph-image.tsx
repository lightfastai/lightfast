import { FeatureLayout } from "@repo/og";
import { OG_HEIGHT, OG_WIDTH } from "@repo/og/brand";
import { ImageResponse } from "next/og";
import { loadOGFonts } from "~/lib/og-fonts";

export const runtime = "nodejs";
export const alt = "Early Access – Lightfast";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image() {
  const fonts = await loadOGFonts();
  return new ImageResponse(
    <FeatureLayout
      description="Get early access to the operating layer between your agents and apps."
      title="Early Access"
    />,
    { ...size, fonts }
  );
}
