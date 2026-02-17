import { ImageResponse } from "next/og";
import { FeatureLayout } from "@repo/og";
import { loadFonts } from "@repo/og/fonts";
import { OG_WIDTH, OG_HEIGHT } from "@repo/og/brand";

export const runtime = "edge";
export const alt = "Lightfast for Engineering Leaders";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image() {
	const fonts = await loadFonts();
	return new ImageResponse(
		<FeatureLayout
			title="For Engineering Leaders"
			description="Understand team health and optimize delivery. From cognitive load estimation to sprint predictions."
		/>,
		{ ...size, fonts },
	);
}
