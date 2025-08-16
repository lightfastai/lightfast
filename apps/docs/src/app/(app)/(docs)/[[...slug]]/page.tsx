import { getPage, getPages } from "@/src/lib/source";
import { mdxComponents } from "@/mdx-components";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export default async function Page({
	params,
}: {
	params: Promise<{ slug?: string[] }>;
}) {
	const resolvedParams = await params;
	const page = getPage(resolvedParams.slug);

	if (!page) {
		return notFound();
	}

	const MDX = page.data.body;

	return (
		<article className="max-w-none">
			<MDX components={mdxComponents} />
		</article>
	);
}

export function generateStaticParams() {
	return getPages().map((page) => ({
		slug: page.slugs,
	}));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
	const resolvedParams = await params;
	const page = getPage(resolvedParams.slug);

	if (!page) {
		return {
			title: "Not Found",
			description: "Page not found",
		};
	}

	return {
		title: page.data.title,
		description: page.data.description,
		openGraph: {
			title: page.data.title,
			description: page.data.description,
		},
		twitter: {
			card: "summary_large_image",
			title: page.data.title,
			description: page.data.description,
		},
	};
}
