"use client";

import { useTRPC } from "~/trpc/react";
import { useSuspenseQuery } from "@tanstack/react-query";

export function AccountTab() {
	const trpc = useTRPC();
	const { data: user } = useSuspenseQuery({
		...trpc.auth.user.getUser.queryOptions(),
		staleTime: 5 * 60 * 1000, // Cache for 5 minutes
	});

	if (!user) {
		return (
			<div className="text-center text-muted-foreground py-8">
				Unable to load account information
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium">Email</span>
				<span className="text-sm text-muted-foreground">{user.email || "Not set"}</span>
			</div>
		</div>
	);
}