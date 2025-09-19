import { AuthenticatedMobileNav } from "./authenticated-mobile-nav";
import { SidebarTrigger } from "@repo/ui/components/ui/sidebar";
import { UserDropdownMenu } from "./user-dropdown-menu";
import { ShareSessionButton } from "./share-session-button";

export function AuthenticatedHeader() {
	return (
		<>
			{/* Mobile/Tablet header - relative positioning */}
			<header className="lg:hidden relative h-14 flex items-center justify-between px-2 bg-background border-b border-border/50 z-10">
				{/* Left side - Sidebar trigger with padding to match sidebar */}
				<div className="pl-2">
					<SidebarTrigger />
				</div>

				{/* Right side - Mobile menu */}
				<div className="flex items-center gap-2 pr-2">
					<AuthenticatedMobileNav />
				</div>
			</header>

			{/* Desktop header - absolute positioning */}
			{/* Desktop Right side only - left side actions moved to sidebar */}
			<header className="hidden lg:flex absolute top-0 right-0 h-14 items-center pr-4 z-10">
				<div className="flex items-center gap-2">
					<ShareSessionButton />
					<UserDropdownMenu />
				</div>
			</header>
		</>
	);
}
