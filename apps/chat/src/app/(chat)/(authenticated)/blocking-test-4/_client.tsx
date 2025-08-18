"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";

export function BlockingTest4Client() {
	const trpc = useTRPC();
	
	// Use suspense query like the real components
	const { data: user } = useSuspenseQuery({
		...trpc.auth.user.getUser.queryOptions(),
		staleTime: 5 * 60 * 1000,
		refetchOnMount: false, // Same as our fix
		refetchOnWindowFocus: false,
	});
	
	return (
		<div className="p-8">
			<h1 className="text-2xl font-bold mb-4">Blocking Test 4</h1>
			<p>With useSuspenseQuery (client component)</p>
			<p>User: {user.email ?? "No user"}</p>
			<p>Time: {new Date().toISOString()}</p>
		</div>
	);
}