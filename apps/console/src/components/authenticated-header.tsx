"use client";

import React from "react";
import { UserDropdownMenu } from "./user-dropdown-menu";
import { OrgSwitcher } from "./org-switcher";
import type { organizations } from "@db/console/schema";

/**
 * Organization data from getUserOrganizations()
 */
interface OrgData {
	id: string; // Clerk org ID
	name: string;
	slug: string;
	role: string;
	deusOrg: typeof organizations.$inferSelect | null;
}

interface AuthenticatedHeaderProps {
	organizations: OrgData[];
}

export function AuthenticatedHeader({ organizations }: AuthenticatedHeaderProps) {
	return (
		<>
			{/* Mobile/Tablet header - relative positioning */}
			<header className="lg:hidden relative h-14 flex items-center justify-between px-4 bg-background border-b border-border/50 z-10">
				{/* Left side - Org Switcher */}
				<div className="flex items-center min-w-0 flex-1">
					<div className="min-w-0 flex-1 max-w-[250px]">
						<OrgSwitcher organizations={organizations} />
					</div>
				</div>

				{/* Right side - User menu */}
				<div className="flex items-center gap-2 shrink-0">
					<UserDropdownMenu />
				</div>
			</header>

			{/* Desktop header - absolute positioning */}
			{/* Left side - Org Switcher */}
			<div className="hidden lg:flex absolute top-0 left-0 h-14 items-center pl-4 z-10 w-fit">
				<div className="w-[250px]">
					<OrgSwitcher organizations={organizations} />
				</div>
			</div>

			{/* Desktop Right side - User menu */}
			<div className="hidden lg:flex absolute top-0 right-0 h-14 items-center pr-2 z-10 w-fit">
				<UserDropdownMenu />
			</div>
		</>
	);
}
