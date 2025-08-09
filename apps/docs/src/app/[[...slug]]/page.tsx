import { getPage, getPages } from "@/src/lib/source";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { DocsBody, DocsPage } from "fumadocs-ui/page";
import type { Metadata } from "next";

export default async function Page({
	params,
}: {
	params: Promise<{ slug?: string[] }>;
}) {
	const resolvedParams = await params;
	const page = getPage(resolvedParams.slug);

	// Show home page or coming soon message if no content found
	if (page == null) {
		const isHomePage = !resolvedParams.slug || resolvedParams.slug.length === 0;
		
		if (isHomePage) {
			return (
				<DocsBody className="container mx-auto px-6 py-16 max-w-4xl">
					<div className="text-center mb-12">
						<h1 className="text-5xl font-bold mb-4">Lightfast Documentation</h1>
						<p className="text-xl text-muted-foreground">
							Learn how to build powerful AI applications with Lightfast
						</p>
					</div>

					<div className="grid gap-6 md:grid-cols-2 mt-12">
						<div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
							<h2 className="text-2xl font-semibold mb-3">Getting Started</h2>
							<p className="text-muted-foreground mb-4">
								Quick setup guides to get you up and running with Lightfast in minutes.
							</p>
						</div>

						<div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
							<h2 className="text-2xl font-semibold mb-3">API Reference</h2>
							<p className="text-muted-foreground mb-4">
								Complete API documentation with examples and best practices.
							</p>
						</div>

						<div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
							<h2 className="text-2xl font-semibold mb-3">Guides & Tutorials</h2>
							<p className="text-muted-foreground mb-4">
								Step-by-step tutorials to help you build amazing AI applications.
							</p>
						</div>

						<div className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
							<h2 className="text-2xl font-semibold mb-3">Examples</h2>
							<p className="text-muted-foreground mb-4">
								Real-world examples and sample applications to learn from.
							</p>
						</div>
					</div>
				</DocsBody>
			);
		}
		
		return (
			<DocsPage>
				<DocsBody>
					<div className="text-center py-16">
						<h1 className="text-4xl font-bold mb-4">Documentation Coming Soon</h1>
						<p className="text-muted-foreground text-lg mb-8">
							We're working on comprehensive documentation for Lightfast.
						</p>
						<p className="text-muted-foreground">
							Check back soon for guides, API references, and tutorials.
						</p>
					</div>
				</DocsBody>
			</DocsPage>
		);
	}

	const MDX = page.data.body;

	return (
		<DocsPage toc={page.data.toc}>
			<DocsBody>
				<h1>{page.data.title}</h1>
				<MDX components={{ ...defaultMdxComponents }} />
			</DocsBody>
		</DocsPage>
	);
}

export function generateStaticParams() {
	return getPages().map((page) => ({
		slug: page.slugs,
	}));
}

export async function generateMetadata({
	params,
}: { params: Promise<{ slug?: string[] }> }): Promise<Metadata> {
	const resolvedParams = await params;
	const page = getPage(resolvedParams.slug);

	if (page == null) {
		return {
			title: "Documentation",
			description: "Lightfast AI Documentation - Coming Soon",
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
