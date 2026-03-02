import { ImageResponse } from "next/og";
import { HomeLayout } from "@repo/og";
import { loadOGFonts } from "~/lib/og-fonts";
import { OG_WIDTH, OG_HEIGHT } from "@repo/og/brand";

export const runtime = "nodejs";
export const alt = "Lightfast – The Operating Layer for Agents and Apps";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image() {
	const fonts = await loadOGFonts();
	return new ImageResponse(<HomeLayout />, { ...size, fonts });
}
