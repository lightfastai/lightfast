import { Settings } from "lucide-react";
import { AuthenticatedHeader } from "~/components/authenticated-header";
import { SettingsSidebar } from "~/components/settings-sidebar";

export default async function SettingsLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;

	return (
		<>
			<AuthenticatedHeader />
			<div className="pt-14 lg:pt-20 px-6 pb-16">
				{/* Header */}
				<div className="mb-8 pt-6">
					<h1 className="text-3xl font-semibold tracking-tight text-foreground">
						Settings
					</h1>
					<p className="mt-2 text-muted-foreground">
						Manage your account and repository connections
					</p>
				</div>

				<div className="flex gap-8">
					{/* Left Sidebar Navigation */}
					<SettingsSidebar orgSlug={slug} />

					{/* Main Content */}
					<div className="flex-1 min-w-0">{children}</div>
				</div>
			</div>
		</>
	);
}
