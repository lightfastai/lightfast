"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import {
	CheckCircle2,
	XCircle,
	AlertCircle,
	Play,
	GitBranch,
	Activity,
	ChevronDown,
	ChevronRight,
	Settings,
	Database,
	Briefcase,
	FileText,
	Shield,
	Key,
	Users,
	Webhook,
	User,
	Cpu,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { WorkspaceActivity, ActivityCategory, ActorType } from "~/types";

interface ActivityTimelineProps {
	activities: WorkspaceActivity[];
	isLoading?: boolean;
}

export function ActivityTimeline({
	activities,
	isLoading,
}: ActivityTimelineProps) {
	const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null);
	const [filterCategory, setFilterCategory] = useState<string>("all");

	// Category icon mapping
	const getCategoryIcon = (category: ActivityCategory) => {
		switch (category) {
			case "auth":
				return Shield;
			case "workspace":
				return Briefcase;
			case "integration":
				return GitBranch;
			case "store":
				return Database;
			case "job":
				return Play;
			case "search":
				return FileText;
			case "document":
				return FileText;
			case "permission":
				return Shield;
			case "api_key":
				return Key;
			case "settings":
				return Settings;
			default:
				return Activity;
		}
	};

	// Actor type icon mapping
	const getActorIcon = (actorType: ActorType) => {
		switch (actorType) {
			case "user":
				return User;
			case "system":
				return Cpu;
			case "webhook":
				return Webhook;
			case "api":
				return Key;
			default:
				return Users;
		}
	};

	// Status color based on action
	const getActionColor = (action: string) => {
		if (action.includes("created") || action.includes("connected")) {
			return "green";
		}
		if (
			action.includes("deleted") ||
			action.includes("disconnected") ||
			action.includes("cancelled")
		) {
			return "red";
		}
		if (action.includes("updated") || action.includes("restarted")) {
			return "blue";
		}
		if (action.includes("failed")) {
			return "red";
		}
		return "gray";
	};

	// Get status icon with color
	const getStatusIcon = (action: string) => {
		const color = getActionColor(action);

		const iconClass = `h-4 w-4 ${
			color === "green"
				? "text-green-600 dark:text-green-400"
				: color === "red"
					? "text-red-600 dark:text-red-400"
					: color === "blue"
						? "text-blue-600 dark:text-blue-400"
						: "text-gray-600 dark:text-gray-400"
		}`;

		const bgClass = `flex h-8 w-8 items-center justify-center rounded-full ${
			color === "green"
				? "bg-green-100 dark:bg-green-900/30"
				: color === "red"
					? "bg-red-100 dark:bg-red-900/30"
					: color === "blue"
						? "bg-blue-100 dark:bg-blue-900/30"
						: "bg-gray-100 dark:bg-gray-900/30"
		}`;

		if (action.includes("created") || action.includes("connected")) {
			return (
				<div className={bgClass}>
					<CheckCircle2 className={iconClass} />
				</div>
			);
		}
		if (
			action.includes("deleted") ||
			action.includes("disconnected") ||
			action.includes("cancelled")
		) {
			return (
				<div className={bgClass}>
					<XCircle className={iconClass} />
				</div>
			);
		}
		if (action.includes("failed")) {
			return (
				<div className={bgClass}>
					<AlertCircle className={iconClass} />
				</div>
			);
		}

		const Icon = getCategoryIcon(action as ActivityCategory);
		return (
			<div className={bgClass}>
				<Icon className={iconClass} />
			</div>
		);
	};

	// Get badge for category
	const getCategoryBadge = (category: ActivityCategory) => {
		const variants: Record<
			ActivityCategory,
			{ label: string; variant: "default" | "secondary" | "outline" | "destructive" }
		> = {
			auth: { label: "Auth", variant: "outline" },
			workspace: { label: "Workspace", variant: "default" },
			integration: { label: "Integration", variant: "secondary" },
			store: { label: "Store", variant: "outline" },
			job: { label: "Job", variant: "default" },
			search: { label: "Search", variant: "outline" },
			document: { label: "Document", variant: "outline" },
			permission: { label: "Permission", variant: "destructive" },
			api_key: { label: "API Key", variant: "secondary" },
			settings: { label: "Settings", variant: "outline" },
		};

		const config = variants[category];
		return (
			<Badge variant={config.variant} className="text-xs">
				{config.label}
			</Badge>
		);
	};

	// Format action name for display
	const formatAction = (action: string) => {
		return action
			.split(".")
			.pop()
			?.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	};

	// Filter activities
	const filteredActivities =
		filterCategory === "all"
			? activities
			: activities.filter((a) => a.category === filterCategory);

	// Limit to 20 most recent
	const displayActivities = filteredActivities.slice(0, 20);

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base font-medium">Activity Timeline</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8 text-sm text-muted-foreground">
						<Activity className="h-8 w-8 mx-auto mb-2 opacity-50 animate-pulse" />
						<p>Loading activity...</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="space-y-4">
				<div className="flex items-center justify-between">
					<CardTitle className="text-base font-medium">Activity Timeline</CardTitle>
					<Select value={filterCategory} onValueChange={setFilterCategory}>
						<SelectTrigger className="w-[180px] h-8">
							<SelectValue placeholder="Filter by category" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Categories</SelectItem>
							<SelectItem value="workspace">Workspace</SelectItem>
							<SelectItem value="integration">Integration</SelectItem>
							<SelectItem value="store">Store</SelectItem>
							<SelectItem value="job">Job</SelectItem>
							<SelectItem value="document">Document</SelectItem>
							<SelectItem value="permission">Permission</SelectItem>
							<SelectItem value="settings">Settings</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</CardHeader>
			<CardContent>
				{displayActivities.length === 0 ? (
					<div className="text-center py-8 text-sm text-muted-foreground">
						<Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
						<p>No recent activity</p>
						<p className="text-xs mt-1">
							{filterCategory === "all"
								? "Activities will appear here as you work"
								: `No ${filterCategory} activities found`}
						</p>
					</div>
				) : (
					<div className="space-y-0">
						{displayActivities.map((activity, index) => {
							const ActorIcon = getActorIcon(activity.actorType);

							return (
								<Collapsible
									key={activity.id}
									open={expandedActivityId === activity.id}
									onOpenChange={(open) =>
										setExpandedActivityId(open ? activity.id : null)
									}
								>
									<div className="relative">
										{/* Timeline connector line */}
										{index < displayActivities.length - 1 && (
											<div className="absolute left-4 top-8 bottom-0 w-px bg-border" />
										)}

										<div className="flex items-start gap-4 py-3">
											{/* Status Icon */}
											<div className="relative z-10 shrink-0">
												{getStatusIcon(activity.action)}
											</div>

											{/* Content */}
											<div className="flex-1 min-w-0 space-y-1">
												<div className="flex items-center justify-between gap-2">
													<div className="flex items-center gap-2 flex-1 min-w-0">
														<CollapsibleTrigger asChild>
															<Button
																variant="ghost"
																size="sm"
																className="h-auto p-0 hover:bg-transparent font-medium text-sm"
															>
																<span className="truncate">
																	{formatAction(activity.action)}
																</span>
																{expandedActivityId === activity.id ? (
																	<ChevronDown className="h-4 w-4 ml-1 shrink-0" />
																) : (
																	<ChevronRight className="h-4 w-4 ml-1 shrink-0" />
																)}
															</Button>
														</CollapsibleTrigger>
														{getCategoryBadge(activity.category)}
													</div>

													{/* Timestamp */}
													<span className="text-xs text-muted-foreground shrink-0">
														{formatDistanceToNow(new Date(activity.timestamp), {
															addSuffix: true,
														})}
													</span>
												</div>

												{/* Metadata */}
												<div className="flex items-center gap-3 text-xs text-muted-foreground">
													<span className="flex items-center gap-1">
														<ActorIcon className="h-3 w-3" />
														{activity.actorType === "user"
															? activity.actorEmail ?? "Unknown user"
															: activity.actorType}
													</span>
													<span>•</span>
													<span>{activity.entityType}</span>
												</div>

												{/* Expandable details */}
												<CollapsibleContent className="pt-2">
													<div className="rounded-lg border bg-muted/50 p-3 space-y-2 text-xs">
														<div className="grid grid-cols-2 gap-2">
															<div>
																<span className="font-medium text-muted-foreground">
																	Activity ID:
																</span>
																<p className="font-mono mt-0.5 text-[10px]">
																	{activity.id}
																</p>
															</div>
															<div>
																<span className="font-medium text-muted-foreground">
																	Timestamp:
																</span>
																<p className="mt-0.5">
																	{new Date(activity.timestamp).toLocaleString()}
																</p>
															</div>
															<div>
																<span className="font-medium text-muted-foreground">
																	Entity ID:
																</span>
																<p className="font-mono mt-0.5 text-[10px]">
																	{activity.entityId}
																</p>
															</div>
															{activity.entityName && (
																<div>
																	<span className="font-medium text-muted-foreground">
																		Entity Name:
																	</span>
																	<p className="mt-0.5">{activity.entityName}</p>
																</div>
															)}
														</div>
														{Object.keys(activity.metadata).length > 0 && (
																<div className="pt-2 border-t">
																	<span className="font-medium text-muted-foreground">
																		Details:
																	</span>
																	<pre className="mt-1 text-[10px] overflow-auto max-h-32 font-mono whitespace-pre-wrap break-words">
																		{JSON.stringify(activity.metadata, null, 2)}
																	</pre>
																</div>
															)}
													</div>
												</CollapsibleContent>
											</div>
										</div>
									</div>
								</Collapsible>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
