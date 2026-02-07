"use client";

import { useUser } from "@clerk/nextjs";
import { NotificationPreferences } from "./_components/notification-preferences";

export default function NotificationsSettingsPage() {
	const { user } = useUser();

	if (!user) {
		return null;
	}

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
			<NotificationPreferences userId={user.id} />
		</div>
	);
}
