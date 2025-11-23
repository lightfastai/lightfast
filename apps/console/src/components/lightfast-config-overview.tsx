"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import DOMPurify from "isomorphic-dompurify";
import { FileCode } from "lucide-react";
import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

/**
 * Lightfast Config Overview Component
 *
 * Note: Uses a simplified Store shape for display in YAML config.
 * The `name` field is mapped from Store.slug in the parent component.
 * This is intentional for better readability in the generated config file.
 */
interface LightfastConfigOverviewProps {
	workspaceName: string;
	stores: {
		id: string;
		name: string; // Mapped from Store.slug for display
		embeddingDim: number;
		documentCount?: number;
	}[];
}

export function LightfastConfigOverview({
	workspaceName,
	stores,
}: LightfastConfigOverviewProps) {
	const [highlightedCode, setHighlightedCode] = useState<string>("");

	// Generate lightfast.yml config with sanitized user input
	// Sanitize all user-provided data to prevent XSS
	const sanitizedWorkspaceName = DOMPurify.sanitize(workspaceName, {
		ALLOWED_TAGS: [],
		ALLOWED_ATTR: [],
	});

	const yamlConfig = `# Lightfast Configuration
workspace:
  name: ${sanitizedWorkspaceName}

stores:
${stores
	.map((store) => {
		const sanitizedStoreName = DOMPurify.sanitize(store.name, {
			ALLOWED_TAGS: [],
			ALLOWED_ATTR: [],
		});
		return `  - name: ${sanitizedStoreName}
    embedding_dim: ${store.embeddingDim}
    vector_db: pinecone
    index_type: hnsw`;
	})
	.join("\n\n")}

indexing:
  chunk_size: 512
  chunk_overlap: 50
  embedding_model: text-embedding-3-small

retrieval:
  top_k: 20
  rerank_model: cross-encoder
  similarity_threshold: 0.7`;

	useEffect(() => {
		async function highlightCode() {
			try {
				const html = await codeToHtml(yamlConfig, {
					lang: "yaml",
					theme: "github-dark",
				});
				// Sanitize Shiki output as additional layer of defense
				const sanitizedHtml = DOMPurify.sanitize(html, {
					ALLOWED_TAGS: ["pre", "code", "span", "div"],
					ALLOWED_ATTR: ["class", "style"],
				});
				setHighlightedCode(sanitizedHtml);
			} catch (error) {
				console.error("Failed to highlight code:", error);
				// Fallback to plain text (sanitized)
				const sanitizedYaml = DOMPurify.sanitize(yamlConfig, {
					ALLOWED_TAGS: [],
					ALLOWED_ATTR: [],
				});
				setHighlightedCode(`<pre><code>${sanitizedYaml}</code></pre>`);
			}
		}

		void highlightCode();
	}, [yamlConfig]);

	return (
		<Card className="border-border/60 h-full">
			<CardHeader className="pb-3">
				<div className="flex items-center gap-2">
					<FileCode className="h-5 w-5 text-muted-foreground" />
					<CardTitle className="text-base font-medium">
						lightfast.yml
					</CardTitle>
				</div>
			</CardHeader>
			<CardContent>
				{/* Syntax highlighted YAML config */}
				<div className="rounded-lg overflow-hidden border border-border/60">
					{highlightedCode ? (
						<div
							className="text-xs [&_pre]:p-4 [&_pre]:m-0 [&_pre]:bg-[#0d1117] [&_pre]:overflow-x-auto"
							dangerouslySetInnerHTML={{ __html: highlightedCode }}
						/>
					) : (
						<div className="p-4 bg-muted/50">
							<div className="h-64 flex items-center justify-center text-xs text-muted-foreground">
								Loading configuration...
							</div>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
