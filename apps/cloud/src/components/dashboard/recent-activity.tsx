"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { 
	Key, 
	Clock, 
	AlertTriangle, 
	ExternalLink,
	Plus,
	Activity
} from "lucide-react";

import { useTRPC } from "~/trpc/react";
import { formatDistanceToNow } from "date-fns";

type ApiKey = {
	id: string;
	name: string;
	keyPreview: string;
	active: boolean;
	lastUsedAt: string | null;
	expiresAt: string | null;
	createdAt: string;
	isExpired: boolean;
};

export function RecentActivity() {
	const trpc = useTRPC();
	
	const { data: apiKeys, isLoading, error } = useQuery({
		...trpc.apiKey.list.queryOptions({ includeInactive: false }),
		staleTime: 2 * 60 * 1000, // 2 minutes
		refetchOnWindowFocus: true,
	});

	if (error) {
		return (
			<Card className="border-destructive/50 bg-destructive/10">
				<CardContent className="p-6">
					<div className="flex items-center space-x-2 text-destructive">
						<AlertTriangle className="h-5 w-5" />
						<p className="font-medium">Failed to load activity</p>
					</div>
					<p className="text-sm text-muted-foreground mt-2">
						{error.message || "Please try refreshing the page."}
					</p>
				</CardContent>
			</Card>
		);
	}

	if (isLoading) {
		return <RecentActivitySkeleton />;
	}

	// Sort keys by most recent activity (created or last used)
	const sortedKeys = apiKeys
		?.map((key: ApiKey) => ({
			...key,
			mostRecentDate: key.lastUsedAt 
				? new Date(Math.max(new Date(key.createdAt).getTime(), new Date(key.lastUsedAt).getTime()))
				: new Date(key.createdAt)
		}))
		.sort((a: ApiKey & { mostRecentDate: Date }, b: ApiKey & { mostRecentDate: Date }) => b.mostRecentDate.getTime() - a.mostRecentDate.getTime())
		.slice(0, 5) || [];

	if (sortedKeys.length === 0) {
		return (
			<Card>
				<CardContent className="p-8">
					<div className="text-center space-y-4">
						<div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
							<Activity className="h-6 w-6 text-muted-foreground" />
						</div>
						<div className="space-y-2">
							<p className="font-medium text-foreground">No API keys yet</p>
							<p className="text-sm text-muted-foreground">
								Create your first API key to start using Lightfast Cloud.
							</p>
						</div>
						<Button asChild>
							<Link href="/api-keys">
								<Plus className="h-4 w-4 mr-2" />
								Create API Key
							</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base font-medium">Latest Activity</CardTitle>
			</CardHeader>
			<CardContent className="p-0">
				<div className="space-y-0">
					{sortedKeys.map((key: ApiKey & { mostRecentDate: Date }, index: number) => {
						const wasRecentlyUsed = key.lastUsedAt && 
							new Date(key.lastUsedAt) > new Date(key.createdAt);
						const isExpiringSoon = key.expiresAt && 
							new Date(key.expiresAt) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
						
						return (
							<div
								key={key.id}
								className={`flex items-center space-x-4 p-4 ${
									index !== sortedKeys.length - 1 ? 'border-b border-border' : ''
								} hover:bg-muted/50 transition-colors`}
							>
								<div className="flex-shrink-0">
									<div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
										<Key className="h-4 w-4 text-primary" />
									</div>
								</div>
								
								<div className="flex-1 min-w-0">
									<div className="flex items-center space-x-2">
										<p className="font-medium text-sm text-foreground truncate">
											{key.name}
										</p>
										<Badge variant="outline" className="text-xs flex-shrink-0">
											{key.keyPreview}
										</Badge>
									</div>
									
									<div className="flex items-center space-x-4 mt-1">
										<p className="text-xs text-muted-foreground flex items-center">
											<Clock className="h-3 w-3 mr-1" />
											{wasRecentlyUsed 
												? `Used ${formatDistanceToNow(new Date(key.lastUsedAt!), { addSuffix: true })}`
												: `Created ${formatDistanceToNow(new Date(key.createdAt), { addSuffix: true })}`
											}
										</p>
										
										{isExpiringSoon && (
											<Badge variant="destructive" className="text-xs">
												Expiring soon
											</Badge>
										)}
									</div>
								</div>
								
								<div className="flex-shrink-0">
									<div className="flex items-center space-x-1">
										{wasRecentlyUsed && (
											<Badge variant="secondary" className="text-xs">
												Active
											</Badge>
										)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
				
				<div className="p-4 border-t border-border">
					<Button variant="ghost" size="sm" asChild className="w-full">
						<Link href="/api-keys" className="flex items-center justify-center">
							View all keys
							<ExternalLink className="h-3 w-3 ml-2" />
						</Link>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function RecentActivitySkeleton() {
	return (
		<Card>
			<CardHeader className="pb-3">
				<div className="h-5 w-24 bg-muted animate-pulse rounded" />
			</CardHeader>
			<CardContent className="p-0">
				<div className="space-y-0">
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={i}
							className={`flex items-center space-x-4 p-4 ${
								i !== 2 ? 'border-b border-border' : ''
							}`}
						>
							<div className="h-10 w-10 bg-muted animate-pulse rounded-full" />
							<div className="flex-1 space-y-2">
								<div className="h-4 w-32 bg-muted animate-pulse rounded" />
								<div className="h-3 w-24 bg-muted animate-pulse rounded" />
							</div>
							<div className="h-3 w-16 bg-muted animate-pulse rounded" />
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	);
}