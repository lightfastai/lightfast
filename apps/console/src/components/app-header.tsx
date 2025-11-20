"use client";

import { useParams, usePathname } from "next/navigation";
import { TeamSwitcher } from "./team-switcher";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { UserDropdownMenu } from "./user-dropdown-menu";

/**
 * Main application header
 *
 * Determines header mode based on current route:
 * - /account/* and /new pages show "My Account" mode
 * - Organization pages show organization mode with workspace switcher
 */
export function AppHeader() {
	const pathname = usePathname();
	const params = useParams();

	// Determine mode based on pathname
	const mode = pathname?.startsWith("/account") || pathname?.startsWith("/new")
		? "account"
		: "organization";

	const workspaceSlug =
		typeof params.workspaceSlug === "string" ? params.workspaceSlug : undefined;

	return (
		<header className="flex items-center justify-between py-2 px-2 bg-background">
			{/* Left side - Team/Workspace Switchers */}
			<div className="flex items-center gap-1">
				<TeamSwitcher mode={mode} />
				{workspaceSlug && (
					<>
						<span className="text-muted-foreground/40 text-sm">/</span>
						<WorkspaceSwitcher workspaceSlug={workspaceSlug} />
					</>
				)}
			</div>

			{/* Right side - User avatar */}
			<UserDropdownMenu />
		</header>
	);
}
