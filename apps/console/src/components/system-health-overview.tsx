"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import {
	ChevronRight,
	ChevronDown,
	Database,
	Box,
	Activity,
	CheckCircle,
	AlertCircle,
	XCircle,
	Github,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { SystemHealth } from "~/types";

interface SystemHealthOverviewProps {
	health: SystemHealth;
}

export function SystemHealthOverview({
	health,
}: SystemHealthOverviewProps) {

	const [expandedStores, setExpandedStores] = useState<Set<string>>(new Set());

	const toggleStore = (storeId: string) => {
		const newExpanded = new Set(expandedStores);
		if (newExpanded.has(storeId)) {
			newExpanded.delete(storeId);
		} else {
			newExpanded.add(storeId);
		}
		setExpandedStores(newExpanded);
	};

	return (
		<Card className="border-border/60">
			<CardHeader className="flex flex-row items-center justify-between pb-3">
				<div className="space-y-1">
					<CardTitle className="text-base font-medium">System Health</CardTitle>
					<p className="text-xs text-muted-foreground">
						Hierarchical view of workspace components
					</p>
				</div>
				<Activity className="h-4 w-4 text-muted-foreground" />
			</CardHeader>
			<CardContent className="space-y-3">
				{/* Workspace Level */}
				<div className="space-y-3">
					<div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
						<HealthIndicator status={health.workspaceHealth} />
						<div className="flex-1">
							<p className="text-sm font-medium">Workspace</p>
							<p className="text-xs text-muted-foreground">
								{health.storesCount} stores, {health.sourcesCount} sources
							</p>
						</div>
						<Badge variant="outline" className="text-xs">
							{health.totalJobs24h} jobs (24h)
						</Badge>
					</div>

					{/* Stores Level */}
					{health.stores.map((store) => {
						const isExpanded = expandedStores.has(store.id);
						return (
							<div key={store.id} className="space-y-2 pl-6 border-l-2 border-border/50">
								<button
									type="button"
									onClick={() => toggleStore(store.id)}
									className="w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
								>
									<div className="flex items-center gap-2 flex-1 min-w-0">
										{isExpanded ? (
											<ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
										) : (
											<ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
										)}
										<HealthIndicator status={store.health} />
										<Box className="h-4 w-4 text-muted-foreground shrink-0" />
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium truncate">{store.name}</p>
											<p className="text-xs text-muted-foreground">
												{store.documentCount.toLocaleString()} documents
											</p>
										</div>
									</div>
									<div className="flex items-center gap-2 shrink-0">
										<Badge variant="outline" className="text-xs">
											{store.embeddingDim}d
										</Badge>
										<Badge
											variant={
												store.successRate >= 95
													? "default"
													: store.successRate >= 80
														? "secondary"
														: "destructive"
											}
											className="text-xs"
										>
											{store.successRate.toFixed(0)}%
										</Badge>
									</div>
								</button>

								{/* Sources Level (expandable) */}
								{isExpanded && store.sources.length > 0 && (
									<div className="space-y-2 pl-6 border-l-2 border-border/30">
										{store.sources.map((source) => (
											<div
												key={source.id}
												className="flex items-center gap-3 p-3 rounded-lg border bg-card"
											>
												<HealthIndicator status={source.health} />
												<SourceIcon type={source.type} />
												<div className="flex-1 min-w-0">
													<p className="text-sm font-medium truncate">
														{source.displayName}
													</p>
													<p className="text-xs text-muted-foreground">
														{source.documentCount.toLocaleString()} documents
													</p>
												</div>
												{source.lastSyncedAt && (
													<p className="text-xs text-muted-foreground shrink-0">
														{formatRelativeTime(new Date(source.lastSyncedAt))}
													</p>
												)}
											</div>
										))}
									</div>
								)}

								{isExpanded && store.sources.length === 0 && (
									<div className="pl-6 border-l-2 border-border/30">
										<div className="p-3 text-center text-xs text-muted-foreground">
											No sources connected to this store
										</div>
									</div>
								)}
							</div>
						);
					})}

					{health.stores.length === 0 && (
						<div className="text-center py-8 text-sm text-muted-foreground">
							<Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
							<p>No stores configured yet</p>
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

function HealthIndicator({
	status,
}: {
	status: "healthy" | "degraded" | "down";
}) {
	const config = {
		healthy: {
			icon: CheckCircle,
			className: "text-green-600",
		},
		degraded: {
			icon: AlertCircle,
			className: "text-yellow-600",
		},
		down: {
			icon: XCircle,
			className: "text-red-600",
		},
	};

	const { icon: Icon, className } = config[status];

	return <Icon className={cn("h-4 w-4 shrink-0", className)} />;
}

function SourceIcon({ type }: { type: string }) {
	// Map source types to icons
	const iconMap = {
		github: Github,
		default: Database,
	};

	const lowerType = type.toLowerCase();
	const Icon: typeof Database =
		lowerType in iconMap
			? iconMap[lowerType as keyof typeof iconMap]
			: iconMap.default;

	return <Icon className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function formatRelativeTime(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return "just now";
	if (diffMins < 60) return `${diffMins}m ago`;
	if (diffHours < 24) return `${diffHours}h ago`;
	if (diffDays < 7) return `${diffDays}d ago`;
	return date.toLocaleDateString();
}
