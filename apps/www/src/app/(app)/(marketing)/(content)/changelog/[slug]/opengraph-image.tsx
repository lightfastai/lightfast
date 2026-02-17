import { ImageResponse } from "next/og";
import { ContentLayout } from "@repo/og";
import { loadFonts } from "@repo/og/fonts";
import { OG_WIDTH, OG_HEIGHT } from "@repo/og/brand";
import { changelog } from "@vendor/cms";

export const runtime = "edge";
export const alt = "Lightfast Changelog Entry";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const fonts = await loadFonts();

	let title = "Changelog";
	let description: string | undefined;
	let date: string | undefined;

	try {
		const entry = await changelog.getEntryBySlug(slug);
		if (entry) {
			title = entry._title ?? "Changelog";
			description = entry.excerpt ?? undefined;
			const publishedAt = entry.publishedAt ?? entry._sys?.createdAt;
			date = publishedAt
				? new Date(publishedAt).toLocaleDateString("en-US", {
						year: "numeric",
						month: "long",
						day: "numeric",
					})
				: undefined;
		}
	} catch {
		// Fall back to defaults
	}

	return new ImageResponse(
		<ContentLayout
			title={title}
			description={description}
			category="Changelog"
			date={date}
		/>,
		{ ...size, fonts },
	);
}
