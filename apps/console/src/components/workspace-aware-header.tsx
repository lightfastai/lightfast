"use client";

import { useParams } from "next/navigation";
import { TeamSwitcher } from "./team-switcher";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { UserDropdownMenu } from "./user-dropdown-menu";

/**
 * Workspace-aware header that shows team + workspace switchers
 */
export function WorkspaceAwareHeader() {
	const params = useParams();
	const workspaceSlug =
		typeof params.workspaceSlug === "string" ? params.workspaceSlug : undefined;

	return (
		<header className="flex items-center justify-between py-2 px-2 bg-background">
			{/* Left side - Team/Workspace Switchers */}
			<div className="flex items-center gap-1">
				<TeamSwitcher />
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
