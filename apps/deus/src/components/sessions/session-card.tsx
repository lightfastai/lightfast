"use client";

import { formatDistanceToNow } from "date-fns";
import {
	Card,
	CardContent,
	CardHeader,
} from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { SessionStatusBadge } from "./session-status-badge";
import { FolderOpen, Bot } from "lucide-react";

type SessionStatus = "active" | "paused" | "completed";
type AgentType = "deus" | "claude-code" | "codex";

interface SessionCardProps {
	id: string;
	status: SessionStatus;
	currentAgent: AgentType | null;
	cwd: string;
	createdAt: string;
}

export function SessionCard({
	id,
	status,
	currentAgent,
	cwd,
	createdAt,
}: SessionCardProps) {
	// Format session ID to first 8 characters
	const shortId = id.slice(0, 8);

	// Format timestamp as relative time
	const relativeTime = formatDistanceToNow(new Date(createdAt), {
		addSuffix: true,
	});

	// Format working directory to show only last 2 segments if too long
	const formatCwd = (path: string) => {
		const segments = path.split("/").filter(Boolean);
		if (segments.length > 3) {
			return `.../${segments.slice(-2).join("/")}`;
		}
		return path;
	};

	return (
		<Card className="hover:bg-muted/50 transition-colors cursor-pointer">
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between gap-3">
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-2">
							<span className="font-mono text-sm font-medium">
								{shortId}
							</span>
							<SessionStatusBadge status={status} />
						</div>
						{currentAgent && (
							<Badge
								variant="outline"
								className="gap-1.5 font-normal text-xs"
							>
								<Bot className="h-3 w-3" />
								{currentAgent}
							</Badge>
						)}
					</div>
					<span className="text-xs text-muted-foreground shrink-0">
						{relativeTime}
					</span>
				</div>
			</CardHeader>
			<CardContent className="pt-0">
				<div className="flex items-center gap-2 text-xs text-muted-foreground">
					<FolderOpen className="h-3.5 w-3.5 shrink-0" />
					<span className="truncate font-mono" title={cwd}>
						{formatCwd(cwd)}
					</span>
				</div>
			</CardContent>
		</Card>
	);
}
