import { ImageResponse } from "next/og";
import { FeatureLayout } from "@repo/og";
import { loadFonts } from "@repo/og/fonts";
import { OG_WIDTH, OG_HEIGHT } from "@repo/og/brand";

export const runtime = "edge";
export const alt = "Early Access – Lightfast";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image() {
	const fonts = await loadFonts();
	return new ImageResponse(
		<FeatureLayout
			title="Early Access"
			description="Join the waitlist for early access to Lightfast neural memory for teams."
		/>,
		{ ...size, fonts },
	);
}
