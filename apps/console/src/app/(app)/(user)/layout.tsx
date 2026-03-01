import { UserPageHeader } from "~/components/user-page-header";

export default function UserLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="relative flex-1 flex flex-col bg-background">
			<UserPageHeader />
			<div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
		</div>
	);
}
