import { UserDropdownMenu } from "./user-dropdown-menu";
import { AuthenticatedMobileNav } from "./authenticated-mobile-nav";
import { SidebarTrigger } from "@repo/ui/components/ui/sidebar";

export function AuthenticatedHeader() {
	return (
		<>
			{/* Mobile/Tablet header - relative positioning */}
			<header className="lg:hidden relative h-14 flex items-center justify-between px-4 bg-background border-b border-border/50 z-10">
				{/* Left side - Sidebar trigger */}
				<SidebarTrigger />

				{/* Right side - Mobile menu */}
				<div className="flex items-center gap-2">
					<AuthenticatedMobileNav />
				</div>
			</header>

			{/* Desktop header - absolute positioning */}
			{/* Desktop Right side only - left side actions moved to sidebar */}
			<header className="hidden lg:flex absolute top-0 right-0 h-14 items-center pr-4 z-10">
				<UserDropdownMenu />
			</header>
		</>
	);
}
