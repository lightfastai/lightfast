import { Suspense } from "react";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { GitHubIntegrationSettings } from "~/components/github-integration-settings";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Github } from "lucide-react";

export default async function GitHubIntegrationPage({
	params: _params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { orgId } = await auth();
	if (!orgId) {
		notFound();
	}

	// No page-specific data prefetching needed
	// Organization data comes from layout prefetch

	// Org layout already wraps in HydrateClient and ErrorBoundary
	return (
		<Suspense fallback={<GitHubIntegrationSkeleton />}>
			<GitHubIntegrationSettings />
		</Suspense>
	);
}

function GitHubIntegrationSkeleton() {
	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Github className="h-5 w-5" />
						GitHub App Integration
					</CardTitle>
					<CardDescription>
						Manage your GitHub App connection and permissions
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<Skeleton className="h-20 w-full" />
					<Skeleton className="h-32 w-full" />
					<Skeleton className="h-24 w-full" />
					<Skeleton className="h-16 w-full" />
				</CardContent>
			</Card>
		</div>
	);
}
