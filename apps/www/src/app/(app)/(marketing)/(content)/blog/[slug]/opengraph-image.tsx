import { ImageResponse } from "next/og";
import { ContentLayout } from "@repo/og";
import { loadFonts } from "@repo/og/fonts";
import { OG_WIDTH, OG_HEIGHT } from "@repo/og/brand";
import { blog } from "@vendor/cms";

export const runtime = "edge";
export const alt = "Lightfast Blog Post";
export const size = { width: OG_WIDTH, height: OG_HEIGHT };
export const contentType = "image/png";

export default async function Image({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const fonts = await loadFonts();

	let title = "Blog";
	let description: string | undefined;
	let category: string | undefined;
	let date: string | undefined;
	let author: string | undefined;

	try {
		const post = await blog.getPost(slug);
		if (post) {
			title = post._title;
			description = post.description ?? undefined;
			category = post.categories?.[0]?._title ?? undefined;
			date = post.publishedAt
				? new Date(post.publishedAt).toLocaleDateString("en-US", {
						year: "numeric",
						month: "long",
						day: "numeric",
					})
				: undefined;
			author = post.authors?.[0]?._title ?? undefined;
		}
	} catch {
		// Fall back to defaults
	}

	return new ImageResponse(
		<ContentLayout
			title={title}
			description={description}
			category={category}
			date={date}
			author={author}
		/>,
		{ ...size, fonts },
	);
}
