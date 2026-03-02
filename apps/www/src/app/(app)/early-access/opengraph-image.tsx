import { ImageResponse } from "next/og";
import { FeatureLayout } from "@repo/og";
import { loadOGFonts } from "~/lib/og-fonts";
import { OG_WIDTH, OG_HEIGHT } from "@repo/og/brand";

export const runtime = "nodejs";
export const alt = "Early Access – Lightfast";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image() {
	const fonts = await loadOGFonts();
	return new ImageResponse(
		<FeatureLayout
			title="Early Access"
			description="Get early access to the operating layer between your agents and apps."
		/>,
		{ ...size, fonts },
	);
}
