import type { Metadata } from "next";
import { SettingsNav } from "./_components/settings-nav";

export const metadata: Metadata = {
	title: "Settings",
	description: "Manage your account settings and preferences.",
};

export default function SettingsLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex h-full">
			{/* Settings Navigation - Left sidebar */}
			<aside className="w-64 flex-shrink-0">
				<div className="p-6">
					<SettingsNav />
				</div>
			</aside>

			{/* Main Content */}
			<main className="flex-1 overflow-auto">{children}</main>
		</div>
	);
}

