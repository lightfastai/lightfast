import { ImageResponse } from "next/og";
import { ContentLayout } from "@repo/og";
import { loadFonts } from "@repo/og/fonts";
import { OG_WIDTH, OG_HEIGHT } from "@repo/og/brand";

export const runtime = "edge";
export const alt = "Lightfast Blog Topic";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image({
	params,
}: {
	params: Promise<{ category: string }>;
}) {
	const { category } = await params;
	const fonts = await loadFonts();

	const title = category
		.split("-")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");

	return new ImageResponse(
		<ContentLayout title={title} category="Blog Topic" />,
		{ ...size, fonts },
	);
}
