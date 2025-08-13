
import { SidebarProvider } from "@repo/ui/components/ui/sidebar";
import { Suspense } from "react";
import { AppSidebar } from "~/components/sidebar/app-sidebar";
import { SidebarSkeleton } from "~/components/sidebar/sidebar-skeleton";
import { UserDropdownMenu } from "~/components/layouts/user-dropdown-menu";

interface ChatLayoutProps {
	children: React.ReactNode;
}

// Main layout component - server component with PPR
export function ChatLayout({ children }: ChatLayoutProps) {
	return (
		<SidebarProvider defaultOpen={true}>
			<div className="flex h-screen w-full">
				<Suspense fallback={<SidebarSkeleton />}>
					<AppSidebar />
				</Suspense>
				<div className="flex border-l border-muted/30 flex-col w-full relative">
					{/* Absolutely positioned header with user dropdown */}
					<header className="absolute top-0 right-0 z-10">
						<div className="flex items-center justify-end px-4 py-2">
							<UserDropdownMenu />
						</div>
					</header>
					{/* Content area starts from 0vh */}
					<div className="flex-1 min-h-0 overflow-hidden">{children}</div>
				</div>
			</div>
		</SidebarProvider>
	);
}