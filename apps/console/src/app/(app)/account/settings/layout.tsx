import { AccountSettingsSidebar } from "~/components/account-settings-sidebar";

export default async function AccountSettingsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="pt-14 lg:pt-20 px-6 pb-16">
			{/* Header */}
			<div className="mb-8 pt-6">
				<h1 className="text-3xl font-semibold tracking-tight text-foreground">
					Account Settings
				</h1>
				<p className="mt-2 text-muted-foreground">
					Manage your personal account preferences and integrations
				</p>
			</div>

			<div className="flex gap-8">
				{/* Left Sidebar Navigation */}
				<AccountSettingsSidebar />

				{/* Main Content */}
				<div className="flex-1 min-w-0">{children}</div>
			</div>
		</div>
	);
}
