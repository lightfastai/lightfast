// Test page with client component using useSuspenseQuery
import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { BlockingTest4Client } from "./_client";

export default function BlockingTest4Page() {
	// Prefetch on server
	prefetch(trpc.auth.user.getUser.queryOptions());
	
	return (
		<HydrateClient>
			<Suspense fallback={<div>Loading...</div>}>
				<BlockingTest4Client />
			</Suspense>
		</HydrateClient>
	);
}