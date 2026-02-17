import { ImageResponse } from "next/og";
import { FeatureLayout } from "@repo/og";
import { loadFonts } from "@repo/og/fonts";
import { OG_WIDTH, OG_HEIGHT } from "@repo/og/brand";

export const runtime = "edge";
export const alt = "Sign Up for Lightfast";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image() {
	const fonts = await loadFonts();
	return new ImageResponse(
		<FeatureLayout title="Sign Up" description="Create your Lightfast account" />,
		{ ...size, fonts },
	);
}
