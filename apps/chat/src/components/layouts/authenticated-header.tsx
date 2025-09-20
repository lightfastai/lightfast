"use client";

import { useSearchParams } from "next/navigation";
import { SidebarTrigger } from "@repo/ui/components/ui/sidebar";
import { AuthenticatedMobileNav } from "./authenticated-mobile-nav";
import { UserDropdownMenu } from "./user-dropdown-menu";
import { MobileActionsMenu } from "./mobile-actions-menu";
import { ShareSessionButton } from "./share-session-button";
import { TemporarySessionButton } from "./temporary-session-badge";

export function AuthenticatedHeader() {
	const searchParams = useSearchParams();
	const mode = searchParams.get("mode");
	const temporary = searchParams.get("temporary");
	const isTemporary = mode === "temporary" || temporary === "1";

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

			{/* Tablet header actions - absolute positioning for non-desktop */}
			<header className="hidden lg:flex xl:hidden absolute top-0 right-0 h-14 items-center pr-4 z-10 flex">
				<div className="flex items-center gap-2">
					<MobileActionsMenu />
				</div>
			</header>

			{/* Desktop header - absolute positioning */}
			{/* Desktop Right side only - left side actions moved to sidebar */}
				<header className="hidden xl:flex absolute top-0 right-0 h-14 items-center pr-4 z-10">
					<div className="flex items-center gap-2">
						<TemporarySessionButton />
						<ShareSessionButton />
						<UserDropdownMenu />
					</div>
				</header>
		</>
	);
}
