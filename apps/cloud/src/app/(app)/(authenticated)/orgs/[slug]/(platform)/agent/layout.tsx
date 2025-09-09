import { Suspense } from "react";
import { trpc, HydrateClient, prefetch } from "~/trpc/server";

interface AgentLayoutProps {
	children: React.ReactNode;
	params: Promise<{ slug: string }>;
}

function AgentLoadingFallback() {
	return (
		<div className="min-h-screen flex items-center justify-center">
			<div className="text-center">
				<div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
				<p className="text-muted-foreground">Loading agents...</p>
			</div>
		</div>
	);
}

function AgentErrorFallback() {
	return (
		<div className="min-h-screen flex items-center justify-center">
			<div className="text-center">
				<div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
					<svg
						className="w-6 h-6 text-red-600"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<p className="text-foreground font-medium mb-2">
					Failed to load agents
				</p>
				<p className="text-muted-foreground text-sm">
					Please try refreshing the page
				</p>
			</div>
		</div>
	);
}

export default async function AgentLayout({
	children,
	params,
}: AgentLayoutProps) {
	const { slug } = await params;

	// Prefetch agent data for instant loading
	prefetch(trpc.agent.list.queryOptions());

	return (
		<HydrateClient>
			<Suspense fallback={<AgentLoadingFallback />}>
				{children}
			</Suspense>
		</HydrateClient>
	);
}