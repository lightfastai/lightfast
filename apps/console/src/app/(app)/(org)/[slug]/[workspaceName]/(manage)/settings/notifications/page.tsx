"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@repo/ui/components/ui/skeleton";
import { Card } from "@repo/ui/components/ui/card";

// Dynamic import to prevent SSR issues with Knock client hooks
const NotificationPreferences = dynamic(
	() =>
		import("./_components/notification-preferences").then(
			(mod) => mod.NotificationPreferences,
		),
	{
		ssr: false,
		loading: () => <PreferencesSkeleton />,
	},
);

function PreferencesSkeleton() {
	return (
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
	);
}

export default function NotificationsSettingsPage() {
	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">
					Notification Preferences
				</h1>
				<p className="text-sm text-muted-foreground mt-2">
					Manage how you receive notifications for workspace activity and
					observations.
				</p>
			</div>

			{/* Knock Preferences Component */}
			<NotificationPreferences />
		</div>
	);
}
