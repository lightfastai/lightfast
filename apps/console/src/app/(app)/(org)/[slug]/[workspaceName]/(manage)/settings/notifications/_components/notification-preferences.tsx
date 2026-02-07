"use client";

import { useNotificationPreferences } from "~/hooks/use-notification-preferences";
import type { CategoryPreference } from "~/hooks/use-notification-preferences";
import type { NotificationCategoryKey } from "@repo/console-types";
import { Card } from "@repo/ui/components/ui/card";
import { Switch } from "@repo/ui/components/ui/switch";
import { Label } from "@repo/ui/components/ui/label";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import {
	Bell,
	Mail,
	AlertTriangle,
	GitPullRequest,
	Calendar,
	BarChart3,
} from "lucide-react";

const CATEGORY_ICONS: Record<NotificationCategoryKey, typeof Bell> = {
	"critical-alerts": AlertTriangle,
	"workflow-updates": GitPullRequest,
	"daily-digests": Calendar,
	"weekly-summaries": BarChart3,
};

const CATEGORY_COLORS: Record<NotificationCategoryKey, string> = {
	"critical-alerts": "text-red-500 bg-red-500/10",
	"workflow-updates": "text-blue-500 bg-blue-500/10",
	"daily-digests": "text-amber-500 bg-amber-500/10",
	"weekly-summaries": "text-purple-500 bg-purple-500/10",
};

export function NotificationPreferences() {
	const {
		loading,
		updating,
		updateChannelPreference,
		knockClient,
		getChannelEnabled,
		getCategoryPreferences,
		updateCategoryPreference,
	} = useNotificationPreferences();

	if (loading) {
		return <PreferencesSkeleton />;
	}

	// Knock client should always be available when Knock provider is configured
	// This check is defensive for edge cases during initialization
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
	if (!knockClient) {
		return (
			<Card className="p-6">
				<p className="text-sm text-muted-foreground">
					Notifications are not configured. Please contact support.
				</p>
			</Card>
		);
	}

	const categoryPreferences = getCategoryPreferences();

	return (
		<div className="space-y-6">
			{/* Global Channel Preferences */}
			<Card className="p-6">
				<div className="space-y-6">
					<div>
						<h3 className="text-lg font-medium">
							Notification Channels
						</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Master switches for each notification channel.
							Turning off a channel here disables it across all
							categories.
						</p>
					</div>

					<div className="space-y-4">
						{/* In-App Notifications */}
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
									<Bell className="h-5 w-5 text-primary" />
								</div>
								<div>
									<Label
										htmlFor="in-app-feed"
										className="text-sm font-medium"
									>
										In-App Notifications
									</Label>
									<p className="text-xs text-muted-foreground">
										Real-time notifications in the bell icon
									</p>
								</div>
							</div>
							<Switch
								id="in-app-feed"
								checked={getChannelEnabled("in_app_feed")}
								onCheckedChange={(checked) =>
									updateChannelPreference(
										"in_app_feed",
										checked,
									)
								}
								disabled={updating}
							/>
						</div>

						{/* Email Notifications */}
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
									<Mail className="h-5 w-5 text-blue-500" />
								</div>
								<div>
									<Label
										htmlFor="email"
										className="text-sm font-medium"
									>
										Email Notifications
									</Label>
									<p className="text-xs text-muted-foreground">
										Emails for critical alerts, workflow
										updates, and digests
									</p>
								</div>
							</div>
							<Switch
								id="email"
								checked={getChannelEnabled("email")}
								onCheckedChange={(checked) =>
									updateChannelPreference("email", checked)
								}
								disabled={updating}
							/>
						</div>
					</div>
				</div>
			</Card>

			{/* Per-Category Preferences */}
			<Card className="p-6">
				<div className="space-y-6">
					<div>
						<h3 className="text-lg font-medium">
							Notification Categories
						</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Control which types of notifications you receive and
							how they&apos;re delivered.
						</p>
					</div>

					<div className="space-y-2">
						{categoryPreferences.map((category) => (
							<CategoryRow
								key={category.categoryKey}
								category={category}
								updating={updating}
								globalEmailEnabled={getChannelEnabled("email")}
								globalInAppEnabled={getChannelEnabled(
									"in_app_feed",
								)}
								onToggle={updateCategoryPreference}
							/>
						))}
					</div>
				</div>
			</Card>
		</div>
	);
}

function CategoryRow({
	category,
	updating,
	globalEmailEnabled,
	globalInAppEnabled,
	onToggle,
}: {
	category: CategoryPreference;
	updating: boolean;
	globalEmailEnabled: boolean;
	globalInAppEnabled: boolean;
	onToggle: (
		categoryKey: NotificationCategoryKey,
		channelType: string,
		enabled: boolean,
	) => Promise<void>;
}) {
	const Icon = CATEGORY_ICONS[category.categoryKey];
	const colorClasses = CATEGORY_COLORS[category.categoryKey];
	const [iconColor, iconBg] = colorClasses.split(" ");

	const isCritical = category.categoryKey === "critical-alerts";

	return (
		<div className="flex items-center justify-between rounded-lg border p-4">
			<div className="flex items-center gap-3 min-w-0">
				<div
					className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
				>
					<Icon className={`h-5 w-5 ${iconColor}`} />
				</div>
				<div className="min-w-0">
					<p className="text-sm font-medium">
						{category.label}
					</p>
					<p className="text-xs text-muted-foreground truncate">
						{category.description}
					</p>
				</div>
			</div>

			<div className="flex items-center gap-4 shrink-0 ml-4">
				{/* In-App Toggle */}
				{category.supportsInApp && (
					<div className="flex items-center gap-1.5">
						<Bell className="h-3.5 w-3.5 text-muted-foreground" />
						<Switch
							checked={
								category.channels.in_app_feed &&
								globalInAppEnabled
							}
							onCheckedChange={(checked) =>
								onToggle(
									category.categoryKey,
									"in_app_feed",
									checked,
								)
							}
							disabled={updating || !globalInAppEnabled}
							aria-label={`${category.label} in-app notifications`}
						/>
					</div>
				)}

				{/* Email Toggle */}
				<div className="flex items-center gap-1.5">
					<Mail className="h-3.5 w-3.5 text-muted-foreground" />
					<Switch
						checked={
							category.channels.email && globalEmailEnabled
						}
						onCheckedChange={(checked) =>
							onToggle(
								category.categoryKey,
								"email",
								checked,
							)
						}
						disabled={updating || !globalEmailEnabled}
						aria-label={`${category.label} email notifications`}
					/>
				</div>

				{/* Critical warning */}
				{isCritical &&
					!category.channels.email &&
					globalEmailEnabled && (
						<span className="text-xs text-amber-500">
							Not recommended
						</span>
					)}
			</div>
		</div>
	);
}

function PreferencesSkeleton() {
	return (
		<div className="space-y-6">
			<Card className="p-6">
				<div className="space-y-6">
					<div>
						<Skeleton className="h-6 w-48" />
						<Skeleton className="h-4 w-96 mt-2" />
					</div>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<Skeleton className="h-10 w-10 rounded-lg" />
								<div className="space-y-1">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-3 w-48" />
								</div>
							</div>
							<Skeleton className="h-6 w-11 rounded-full" />
						</div>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<Skeleton className="h-10 w-10 rounded-lg" />
								<div className="space-y-1">
									<Skeleton className="h-4 w-32" />
									<Skeleton className="h-3 w-48" />
								</div>
							</div>
							<Skeleton className="h-6 w-11 rounded-full" />
						</div>
					</div>
				</div>
			</Card>
			<Card className="p-6">
				<div className="space-y-6">
					<div>
						<Skeleton className="h-6 w-52" />
						<Skeleton className="h-4 w-80 mt-2" />
					</div>
					<div className="space-y-2">
						{[1, 2, 3, 4].map((i) => (
							<div
								key={i}
								className="flex items-center justify-between rounded-lg border p-4"
							>
								<div className="flex items-center gap-3">
									<Skeleton className="h-10 w-10 rounded-lg" />
									<div className="space-y-1">
										<Skeleton className="h-4 w-28" />
										<Skeleton className="h-3 w-56" />
									</div>
								</div>
								<div className="flex items-center gap-4">
									<Skeleton className="h-6 w-11 rounded-full" />
									<Skeleton className="h-6 w-11 rounded-full" />
								</div>
							</div>
						))}
					</div>
				</div>
			</Card>
		</div>
	);
}
