import { getPage, getPages } from "@/src/lib/source";
import { mdxComponents } from "@/mdx-components";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeveloperPlatformLanding } from "./_components/developer-platform-landing";
import { DocsLayout } from "@/src/components/docs-layout";

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

	// Show custom landing page for the get-started/overview page
	if (
		resolvedParams.slug?.length === 2 &&
		resolvedParams.slug[0] === "get-started" &&
		resolvedParams.slug[1] === "overview"
	) {
		return <DeveloperPlatformLanding />;
	}

	const MDX = page.data.body;
	const toc = page.data.toc;

	return (
		<DocsLayout toc={toc}>
			<article className="max-w-none">
				<MDX components={mdxComponents} />
			</article>
		</DocsLayout>
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
