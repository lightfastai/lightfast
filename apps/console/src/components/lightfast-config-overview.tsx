"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { FileCode } from "lucide-react";
import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

/**
 * Lightfast Config Overview Component
 *
 * Note: Updated for single-store architecture (1:1 relationship).
 * Embedding config now lives directly on workspace.
 */
interface LightfastConfigOverviewProps {
	workspaceName: string;
	store: {
		id: string;
		embeddingModel: string;
		embeddingDim: number;
		chunkMaxTokens: number;
		chunkOverlap: number;
		documentCount?: number;
	} | null;
}

export function LightfastConfigOverview({
	workspaceName,
	store,
}: LightfastConfigOverviewProps) {
	const [highlightedCode, setHighlightedCode] = useState<string>("");

	// Generate lightfast.yml config
	// Escape YAML special characters in user input
	const escapeYaml = (str: string) => {
		// If string contains special YAML characters, quote it
		if (/[:{}[\],&*#?|\-<>=!%@`]/.test(str)) {
			return `"${str.replace(/"/g, '\\"')}"`;
		}
		return str;
	};

	const yamlConfig = store
		? `# Lightfast Configuration
workspace:
  name: ${escapeYaml(workspaceName)}

embedding:
  model: ${store.embeddingModel}
  dimension: ${store.embeddingDim}

indexing:
  chunk_size: ${store.chunkMaxTokens}
  chunk_overlap: ${store.chunkOverlap}

retrieval:
  top_k: 20
  rerank_model: cross-encoder
  similarity_threshold: 0.7`
		: `# Lightfast Configuration
workspace:
  name: ${escapeYaml(workspaceName)}

# Store not configured yet
# Connect a source to automatically create a store

embedding:
  model: embed-english-v3.0
  dimension: 1024

indexing:
  chunk_size: 512
  chunk_overlap: 50

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
				// Fallback to plain text with HTML-escaped content
				const escapedYaml = yamlConfig
					.replace(/&/g, "&amp;")
					.replace(/</g, "&lt;")
					.replace(/>/g, "&gt;");
				setHighlightedCode(`<pre><code>${escapedYaml}</code></pre>`);
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
