"use client";

import { useTRPC } from "@repo/chat-trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";

export function AccountTab() {
	const trpc = useTRPC();
	const { data: user } = useSuspenseQuery({
		...trpc.user.getUser.queryOptions(),
		staleTime: 5 * 60 * 1000, // Cache for 5 minutes
	})

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium">Email</span>
				<span className="text-xs text-muted-foreground">{user.email ?? "Not set"}</span>
			</div>
		</div>
	);
}