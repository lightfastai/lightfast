"use client";

import {
	useNotificationPreferences,
	type ChannelPreference,
} from "@vendor/knock/components/preferences";
import { Card } from "@repo/ui/components/ui/card";
import { Switch } from "@repo/ui/components/ui/switch";
import { Label } from "@repo/ui/components/ui/label";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Bell, Mail } from "lucide-react";

interface NotificationPreferencesProps {
	userId: string;
}

export function NotificationPreferences({
	userId,
}: NotificationPreferencesProps) {
	const {
		preferences,
		loading,
		updating,
		updateChannelPreference,
		knockClient,
		getChannelEnabled,
	} = useNotificationPreferences();

	if (loading) {
		return <PreferencesSkeleton />;
	}

	if (!knockClient) {
		return (
			<Card className="p-6">
				<p className="text-sm text-muted-foreground">
					Notifications are not configured. Please contact support.
				</p>
			</Card>
		);
	}

	const channelPreferences: ChannelPreference[] = [
		{
			channelType: "in_app_feed",
			enabled: getChannelEnabled("in_app_feed"),
		},
		{
			channelType: "email",
			enabled: getChannelEnabled("email"),
		},
	];

	return (
		<div className="space-y-6">
			{/* Global Channel Preferences */}
			<Card className="p-6">
				<div className="space-y-6">
					<div>
						<h3 className="text-lg font-medium">Notification Channels</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Choose how you want to receive notifications for all workspace
							activity.
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
									<Label htmlFor="in-app-feed" className="text-sm font-medium">
										In-App Notifications
									</Label>
									<p className="text-xs text-muted-foreground">
										Real-time notifications in the bell icon
									</p>
								</div>
							</div>
							<Switch
								id="in-app-feed"
								checked={
									channelPreferences.find(
										(p) => p.channelType === "in_app_feed",
									)?.enabled ?? true
								}
								onCheckedChange={(checked) =>
									updateChannelPreference("in_app_feed", checked)
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
									<Label htmlFor="email" className="text-sm font-medium">
										Email Notifications
									</Label>
									<p className="text-xs text-muted-foreground">
										Batched emails every 5 minutes
									</p>
								</div>
							</div>
							<Switch
								id="email"
								checked={
									channelPreferences.find((p) => p.channelType === "email")
										?.enabled ?? true
								}
								onCheckedChange={(checked) =>
									updateChannelPreference("email", checked)
								}
								disabled={updating}
							/>
						</div>
					</div>
				</div>
			</Card>

			{/* Per-Workflow Preferences (Future) */}
			<Card className="p-6">
				<div className="space-y-4">
					<div>
						<h3 className="text-lg font-medium">Workflow Preferences</h3>
						<p className="text-sm text-muted-foreground mt-1">
							Fine-tune notifications for specific workflow types.
						</p>
					</div>

					<div className="rounded-lg border border-dashed p-4">
						<p className="text-sm text-muted-foreground text-center">
							Per-workflow preferences coming soon. For now, channel preferences
							apply to all workflows.
						</p>
					</div>
				</div>
			</Card>
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
		</div>
	);
}
