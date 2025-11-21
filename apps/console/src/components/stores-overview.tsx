"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@repo/ui/components/ui/dialog";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import { Database, FileText, Settings, ChevronDown } from "lucide-react";
import type { Store } from "~/types";

interface StoresOverviewProps {
	stores: Store[];
	totalStores: number;
}

export function StoresOverview({ stores, totalStores }: StoresOverviewProps) {
	const [selectedStore, setSelectedStore] = useState<Store | null>(null);
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			<Collapsible open={isOpen} onOpenChange={setIsOpen}>
				<Card className="border-border/60">
					<CardHeader className="pb-3">
						<CollapsibleTrigger asChild>
							<Button
								variant="ghost"
								className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent"
							>
								<div className="flex items-center justify-between w-full">
									<div className="space-y-1 text-left">
										<div className="flex items-center gap-2">
											<CardTitle className="text-base font-medium">
												Vector Stores ({totalStores})
											</CardTitle>
											<ChevronDown
												className={`h-4 w-4 text-muted-foreground transition-transform ${
													isOpen ? "transform rotate-180" : ""
												}`}
											/>
										</div>
										<p className="text-xs text-muted-foreground">
											{totalStores} {totalStores === 1 ? "store" : "stores"}{" "}
											configured across workspace
										</p>
									</div>
									<Settings className="h-4 w-4 text-muted-foreground" />
								</div>
							</Button>
						</CollapsibleTrigger>
					</CardHeader>
					<CollapsibleContent>
						<CardContent className="space-y-3 pt-0">
							{stores.length === 0 ? (
								<div className="text-center py-8 text-sm text-muted-foreground">
									<Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
									<p>No stores configured yet</p>
									<p className="text-xs mt-1">
										Stores are created automatically when you connect a repository
									</p>
								</div>
							) : (
								stores.map((store) => (
									<button
										key={store.id}
										onClick={() => setSelectedStore(store)}
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
															{store.slug}
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
								))
							)}
						</CardContent>
					</CollapsibleContent>
				</Card>
			</Collapsible>

			<Dialog open={!!selectedStore} onOpenChange={() => setSelectedStore(null)}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Store Configuration</DialogTitle>
						<DialogDescription>
							Vector store details and configuration
						</DialogDescription>
					</DialogHeader>

					{selectedStore && (
						<div className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="space-y-1">
									<p className="text-sm font-medium text-muted-foreground">
										Store Name
									</p>
									<p className="text-sm font-mono">{selectedStore.slug}</p>
								</div>
								<div className="space-y-1">
									<p className="text-sm font-medium text-muted-foreground">
										Embedding Dimension
									</p>
									<p className="text-sm">{selectedStore.embeddingDim}d</p>
								</div>
								<div className="space-y-1">
									<p className="text-sm font-medium text-muted-foreground">
										Pinecone Index
									</p>
									<p className="text-sm font-mono break-all">
										{selectedStore.indexName}
									</p>
								</div>
								<div className="space-y-1">
									<p className="text-sm font-medium text-muted-foreground">
										Document Count
									</p>
									<p className="text-sm">
										{selectedStore.documentCount.toLocaleString()}
									</p>
								</div>
								<div className="space-y-1 col-span-2">
									<p className="text-sm font-medium text-muted-foreground">
										Created
									</p>
									<p className="text-sm">
										{new Date(selectedStore.createdAt).toLocaleString()}
									</p>
								</div>
							</div>

							<div className="rounded-lg bg-muted p-4 space-y-2">
								<p className="text-sm font-medium">lightfast.yml Configuration</p>
								<pre className="text-xs bg-background p-3 rounded border overflow-auto">
									{`version: 1
store: ${selectedStore.slug}
embedding:
  dimension: ${selectedStore.embeddingDim}
  model: text-embedding-3-small

chunking:
  strategy: semantic
  maxTokens: 512
  overlap: 64

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
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
