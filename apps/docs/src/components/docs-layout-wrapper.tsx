import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { source } from "../lib/source";
import { createDocsOptions } from "./docs-layout-config";
import { DocsHeader } from "./docs-header";

export function DocsLayoutWrapper({ children }: { children: ReactNode }) {
	// Create the docs options with the page tree from source
	const docsOptions = createDocsOptions(source.pageTree);

	return (
		<>
			<DocsHeader />
			<DocsLayout {...docsOptions}>
				<div className="flex flex-col w-full">{children}</div>
			</DocsLayout>
		</>
	);
}
