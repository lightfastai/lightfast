"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/ui/dialog";
import { Database, FileText, Settings } from "lucide-react";
import type { Store } from "~/types";

interface StoreOverviewProps {
	store: Store | null;
}

/**
 * Store Overview Component
 *
 * Displays the workspace's single store (1:1 relationship).
 * Each workspace has exactly one store.
 */
export function StoreOverview({ store }: StoreOverviewProps) {
	const [showDetails, setShowDetails] = useState(false);

	if (!store) {
		return (
			<Card className="border-border/60">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<CardTitle className="text-base font-medium">
								Vector Store
							</CardTitle>
							<p className="text-xs text-muted-foreground">
								Store will be created when you connect a source
							</p>
						</div>
						<Settings className="h-4 w-4 text-muted-foreground" />
					</div>
				</CardHeader>
				<CardContent className="pt-0">
					<div className="text-center py-8 text-sm text-muted-foreground">
						<Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
						<p>No store configured yet</p>
						<p className="text-xs mt-1">
							Connect a repository to automatically create a vector store
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<>
			<Card className="border-border/60">
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<CardTitle className="text-base font-medium">
								Vector Store
							</CardTitle>
							<p className="text-xs text-muted-foreground">
								Workspace knowledge storage
							</p>
						</div>
						<Settings className="h-4 w-4 text-muted-foreground" />
					</div>
				</CardHeader>
				<CardContent className="pt-0">
					<button
						onClick={() => setShowDetails(true)}
						className="w-full"
						type="button"
					>
						<div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left">
							<div className="flex items-center gap-3 flex-1 min-w-0">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
									<Database className="h-5 w-5 text-primary" />
								</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2 mb-1">
										<p className="text-sm font-medium truncate">
											{store.embeddingModel}
										</p>
										<Badge
											variant="secondary"
											className="text-xs shrink-0"
										>
											{store.embeddingDim}d
										</Badge>
									</div>
									<div className="flex items-center gap-3 text-xs text-muted-foreground">
										<span className="flex items-center gap-1">
											<FileText className="h-3 w-3" />
											{store.documentCount.toLocaleString()}{" "}
											{store.documentCount === 1 ? "doc" : "docs"}
										</span>
									</div>
								</div>
							</div>
						</div>
					</button>
				</CardContent>
			</Card>

			<Dialog open={showDetails} onOpenChange={setShowDetails}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Store Configuration</DialogTitle>
						<DialogDescription>
							Vector store details and configuration
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-1">
								<p className="text-sm font-medium text-muted-foreground">
									Embedding Model
								</p>
								<p className="text-sm font-mono">{store.embeddingModel}</p>
							</div>
							<div className="space-y-1">
								<p className="text-sm font-medium text-muted-foreground">
									Embedding Dimension
								</p>
								<p className="text-sm">{store.embeddingDim}d</p>
							</div>
							<div className="space-y-1">
								<p className="text-sm font-medium text-muted-foreground">
									Pinecone Index
								</p>
								<p className="text-sm font-mono break-all">
									{store.indexName}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-sm font-medium text-muted-foreground">
									Namespace
								</p>
								<p className="text-sm font-mono break-all">
									{store.namespaceName}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-sm font-medium text-muted-foreground">
									Document Count
								</p>
								<p className="text-sm">
									{store.documentCount.toLocaleString()}
								</p>
							</div>
							<div className="space-y-1">
								<p className="text-sm font-medium text-muted-foreground">
									Chunking
								</p>
								<p className="text-sm">
									{store.chunkMaxTokens} tokens, {store.chunkOverlap} overlap
								</p>
							</div>
							<div className="space-y-1 col-span-2">
								<p className="text-sm font-medium text-muted-foreground">
									Created
								</p>
								<p className="text-sm">
									{new Date(store.createdAt).toLocaleString()}
								</p>
							</div>
						</div>

						<div className="rounded-lg bg-muted p-4 space-y-2">
							<p className="text-sm font-medium">lightfast.yml Configuration</p>
							<pre className="text-xs bg-background p-3 rounded border overflow-auto">
								{`version: 1
embedding:
  dimension: ${store.embeddingDim}
  model: ${store.embeddingModel}

chunking:
  maxTokens: ${store.chunkMaxTokens}
  overlap: ${store.chunkOverlap}

include:
  - docs/**/*.md
  - docs/**/*.mdx

exclude:
  - node_modules
  - .git`}
							</pre>
							<p className="text-xs text-muted-foreground">
								This is an example configuration. Actual config is determined
								by connected repositories.
							</p>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}

// Keep backward compatibility alias
export { StoreOverview as StoresOverview };
