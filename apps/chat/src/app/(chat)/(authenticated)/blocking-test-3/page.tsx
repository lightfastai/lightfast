// Test page with prefetch (like [sessionId]/page.tsx)
import { Suspense } from "react";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";

export default function BlockingTest3Page() {
	// Prefetch user data like the real pages do
	prefetch(trpc.auth.user.getUser.queryOptions());
	
	return (
		<HydrateClient>
			<Suspense fallback={<div>Loading...</div>}>
				<div className="p-8">
					<h1 className="text-2xl font-bold mb-4">Blocking Test 3</h1>
					<p>With prefetch + HydrateClient (like [sessionId])</p>
					<p>Time: {new Date().toISOString()}</p>
				</div>
			</Suspense>
		</HydrateClient>
	);
}