"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { AlertTriangle, Key, Activity, Clock } from "lucide-react";

import { useTRPC } from "~/trpc/react";

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

export function OverviewCards() {
	const api = useTRPC();
	
	if (!api?.apiKey?.list) {
		return (
			<Card className="border-destructive/50 bg-destructive/10">
				<CardContent className="p-6">
					<div className="flex items-center space-x-2 text-destructive">
						<AlertTriangle className="h-5 w-5" />
						<p className="font-medium">API not available</p>
					</div>
				</CardContent>
			</Card>
		);
	}
	
	const { data: apiKeys, isLoading, error } = (api as any).apiKey.list.useQuery(
		{ includeInactive: true },
		{
			staleTime: 5 * 60 * 1000, // 5 minutes
			refetchOnWindowFocus: false,
		}
	);

	const stats = useMemo(() => {
		if (!apiKeys) {
			return {
				total: 0,
				active: 0,
				recentlyUsed: 0,
				expiring: 0,
			};
		}

		const now = new Date();
		const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

		const active = apiKeys.filter((key: ApiKey) => key.active && !key.isExpired).length;
		const recentlyUsed = apiKeys.filter((key: ApiKey) => {
			if (!key.lastUsedAt) return false;
			const lastUsed = new Date(key.lastUsedAt);
			const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
			return lastUsed > thirtyDaysAgo;
		}).length;
		const expiring = apiKeys.filter((key: ApiKey) => {
			if (!key.expiresAt || key.isExpired || !key.active) return false;
			const expiresAt = new Date(key.expiresAt);
			return expiresAt <= sevenDaysFromNow;
		}).length;

		return {
			total: apiKeys.length,
			active,
			recentlyUsed,
			expiring,
		};
	}, [apiKeys]);

	if (error) {
		return (
			<Card className="border-destructive/50 bg-destructive/10">
				<CardContent className="p-6">
					<div className="flex items-center space-x-2 text-destructive">
						<AlertTriangle className="h-5 w-5" />
						<p className="font-medium">Failed to load statistics</p>
					</div>
					<p className="text-sm text-muted-foreground mt-2">
						{error.message || "Please try refreshing the page."}
					</p>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
			{/* Total API Keys */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Total API Keys</CardTitle>
					<Key className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">
						{isLoading ? <Skeleton className="h-8 w-16" /> : stats.total}
					</div>
					<p className="text-xs text-muted-foreground">
						All keys in your account
					</p>
				</CardContent>
			</Card>

			{/* Active Keys */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Active Keys</CardTitle>
					<Activity className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">
						{isLoading ? (
							<Skeleton className="h-8 w-16" />
						) : (
							<div className="flex items-center space-x-2">
								<span>{stats.active}</span>
								{stats.active > 0 && (
									<Badge variant="secondary" className="text-xs">
										Ready
									</Badge>
								)}
							</div>
						)}
					</div>
					<p className="text-xs text-muted-foreground">
						Valid and non-expired
					</p>
				</CardContent>
			</Card>

			{/* Recent Usage */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Recent Usage</CardTitle>
					<Clock className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">
						{isLoading ? <Skeleton className="h-8 w-16" /> : stats.recentlyUsed}
					</div>
					<p className="text-xs text-muted-foreground">
						Used in last 30 days
					</p>
				</CardContent>
			</Card>

			{/* Expiring Soon */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
					<CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
					<AlertTriangle className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="text-2xl font-bold">
						{isLoading ? (
							<Skeleton className="h-8 w-16" />
						) : (
							<div className="flex items-center space-x-2">
								<span>{stats.expiring}</span>
								{stats.expiring > 0 && (
									<Badge variant="destructive" className="text-xs">
										Warning
									</Badge>
								)}
							</div>
						)}
					</div>
					<p className="text-xs text-muted-foreground">
						Expire within 7 days
					</p>
				</CardContent>
			</Card>
		</div>
	);
}