import { ImageResponse } from "next/og";
import { HomeLayout } from "@repo/og";
import { loadFonts } from "@repo/og/fonts";
import { OG_WIDTH, OG_HEIGHT } from "@repo/og/brand";

export const runtime = "edge";
export const alt = "Lightfast – The Memory Layer for Software Teams";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image() {
	const fonts = await loadFonts();
	return new ImageResponse(
		<HomeLayout tagline="Search everything your engineering org knows—code, PRs, docs, decisions—with answers that cite their sources" />,
		{ ...size, fonts },
	);
}
