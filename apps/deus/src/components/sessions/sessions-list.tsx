"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@repo/deus-trpc/react";
import { SessionCard } from "./session-card";
import { useState } from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { Inbox } from "lucide-react";

interface SessionsListProps {
	organizationId: string;
}

type SessionStatus = "active" | "paused" | "completed";

export function SessionsList({ organizationId }: SessionsListProps) {
	const trpc = useTRPC();
	const [statusFilter, setStatusFilter] = useState<SessionStatus | "all">("all");

	// Fetch sessions with auto-refresh every 5 seconds
	const { data } = useSuspenseQuery({
		...trpc.session.list.queryOptions({
			organizationId,
			status: statusFilter === "all" ? undefined : statusFilter,
		}),
		refetchOnMount: false,
		refetchOnWindowFocus: false,
		refetchInterval: 5000, // Auto-refresh every 5 seconds
	});

	const sessions = data.sessions;

	return (
		<div className="space-y-4">
			{/* Filter Controls */}
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-semibold">
					Sessions {sessions.length > 0 && `(${sessions.length})`}
				</h2>
				<Select
					value={statusFilter}
					onValueChange={(value) => setStatusFilter(value as SessionStatus | "all")}
				>
					<SelectTrigger className="w-[140px] h-8">
						<SelectValue placeholder="All statuses" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="active">Active</SelectItem>
						<SelectItem value="paused">Paused</SelectItem>
						<SelectItem value="completed">Completed</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Sessions List */}
			{sessions.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<Inbox className="h-12 w-12 text-muted-foreground/50 mb-3" />
					<p className="text-sm font-medium mb-1">No sessions found</p>
					<p className="text-xs text-muted-foreground">
						{statusFilter === "all"
							? "Start using Deus CLI to create your first session"
							: `No ${statusFilter} sessions at the moment`}
					</p>
				</div>
			) : (
				<div className="grid gap-3">
					{sessions.map((session) => (
						<SessionCard
							key={session.id}
							id={session.id}
							status={session.status as SessionStatus}
							currentAgent={session.currentAgent}
							cwd={session.cwd}
							createdAt={session.createdAt}
						/>
					))}
				</div>
			)}
		</div>
	);
}
