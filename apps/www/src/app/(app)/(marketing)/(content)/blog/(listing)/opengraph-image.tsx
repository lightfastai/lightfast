import { ImageResponse } from "next/og";
import { ContentLayout } from "@repo/og";
import { loadFonts } from "@repo/og/fonts";
import { OG_WIDTH, OG_HEIGHT } from "@repo/og/brand";

export const runtime = "edge";
export const alt = "Lightfast Blog";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image() {
	const fonts = await loadFonts();
	return new ImageResponse(
		<ContentLayout
			title="Blog"
			description="Team memory, semantic search, and answer-with-sources systems for engineering and platform teams."
		/>,
		{ ...size, fonts },
	);
}
