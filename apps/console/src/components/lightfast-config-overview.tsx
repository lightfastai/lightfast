"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { FileCode } from "lucide-react";
import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

interface LightfastConfigOverviewProps {
	workspaceId: string;
	workspaceName: string;
	stores: {
		id: string;
		name: string;
		embeddingDim: number;
		documentCount?: number;
	}[];
}

export function LightfastConfigOverview({
	workspaceId,
	workspaceName,
	stores,
}: LightfastConfigOverviewProps) {
	const [highlightedCode, setHighlightedCode] = useState<string>("");

	// Generate lightfast.yml config
	const yamlConfig = `# Lightfast Configuration
workspace:
  id: ${workspaceId}
  name: ${workspaceName}

stores:
${stores
	.map(
		(store) => `  - name: ${store.name}
    embedding_dim: ${store.embeddingDim}
    vector_db: pinecone
    index_type: hnsw`,
	)
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
				setHighlightedCode(html);
			} catch (error) {
				console.error("Failed to highlight code:", error);
				// Fallback to plain text
				setHighlightedCode(`<pre><code>${yamlConfig}</code></pre>`);
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
