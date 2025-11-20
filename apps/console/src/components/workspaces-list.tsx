"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/console-trpc/react";
import { Plus, Search, Database, FileText, Activity, Clock } from "lucide-react";
import Link from "next/link";
import { useState, useMemo } from "react";
import { Input } from "@repo/ui/components/ui/input";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { Card, CardContent } from "@repo/ui/components/ui/card";

interface WorkspacesListProps {
	orgSlug: string;
}

export function WorkspacesList({ orgSlug }: WorkspacesListProps) {
	const trpc = useTRPC();
	const [searchQuery, setSearchQuery] = useState("");

	// Fetch workspaces for this organization (prefetched in layout)
	const { data: workspaces = [] } = useSuspenseQuery({
		...trpc.workspace.listByClerkOrgSlug.queryOptions({
			clerkOrgSlug: orgSlug,
		}),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		staleTime: 5 * 60 * 1000,
	});

	// Filter workspaces by search query
	const filteredWorkspaces = workspaces.filter((workspace) =>
		workspace.slug.toLowerCase().includes(searchQuery.toLowerCase()),
	);

	return (
		<div className="space-y-6">
			{/* Search and Create Button */}
			<div className="flex items-center justify-between gap-4">
				<div className="relative flex-1 max-w-sm">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search workspaces..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-9"
					/>
				</div>
				<Button className="gap-2" asChild>
					<Link href={`/new?teamSlug=${orgSlug}`}>
						<Plus className="h-4 w-4" />
						New workspace
					</Link>
				</Button>
			</div>

			{/* Empty States */}
			{filteredWorkspaces.length === 0 && searchQuery ? (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
					<p className="text-sm font-medium">No workspaces found</p>
					<p className="text-xs text-muted-foreground mt-1">
						No workspaces matching &quot;{searchQuery}&quot;
					</p>
				</div>
			) : filteredWorkspaces.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<p className="text-sm font-medium">No workspaces yet</p>
					<p className="text-xs text-muted-foreground mt-1">
						Create your first workspace to get started
					</p>
				</div>
			) : (
				<>
					{/* Workspaces Grid */}
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{filteredWorkspaces.map((workspace) => (
							<Link
								key={workspace.id}
								href={`/${orgSlug}/${workspace.slug}`}
								className="group"
							>
								<Card className="h-full transition-colors hover:bg-accent/50 border-border/60">
									<CardContent className="p-6">
										{/* Mini Chart Area - Placeholder */}
										<div className="h-16 mb-4 rounded-md bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex items-end px-1 gap-0.5">
											{/* Mini bar chart visualization */}
											{[...Array(20)].map((_, i) => {
												const height = Math.random() * 60 + 20;
												return (
													<div
														key={i}
														className="flex-1 bg-primary/30 rounded-sm"
														style={{ height: `${height}%` }}
													/>
												);
											})}
										</div>

										{/* Workspace Name and Badge */}
										<div className="mb-4">
											<div className="flex items-center gap-2 mb-1">
												<h3 className="font-semibold text-base group-hover:text-primary transition-colors capitalize">
													{workspace.slug.replace(/-/g, " ")}
												</h3>
												{workspace.isDefault && (
													<Badge variant="secondary" className="text-xs h-5">
														Default
													</Badge>
												)}
											</div>
										</div>

										{/* Created Date */}
										<div className="pt-4 border-t border-border/40">
											<p className="text-xs text-muted-foreground">
												Created{" "}
												{new Date(workspace.createdAt).toLocaleDateString("en-US", {
													month: "short",
													day: "numeric",
													year: "numeric",
												})}
											</p>
										</div>
									</CardContent>
								</Card>
							</Link>
						))}
					</div>
				</>
			)}
		</div>
	);
}
