"use client";

import {
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuItem,
	useSidebar,
} from "@lightfast/ui/components/ui/sidebar";
import type { Preloaded } from "convex/react";
import { useEffect, useState } from "react";
import type { api } from "../../../../convex/_generated/api";
import { SidebarUserMenu } from "./sidebar-user-menu";

interface SidebarFooterWrapperProps {
	preloadedUser: Preloaded<typeof api.users.current>;
}

export function SidebarFooterWrapper({
	preloadedUser,
}: SidebarFooterWrapperProps) {
	const { state } = useSidebar();
	const [isTransitioning, setIsTransitioning] = useState(false);

	useEffect(() => {
		// Set transitioning state when sidebar state changes
		setIsTransitioning(true);
		const timer = setTimeout(() => {
			setIsTransitioning(false);
		}, 300); // Match the sidebar transition duration

		return () => clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [state]);

	return (
		<SidebarFooter className="p-0">
			<SidebarGroup className="p-2 relative">
				<SidebarGroupContent>
					<SidebarMenu>
						<SidebarMenuItem
							className="overflow-visible"
							style={{
								// Prevent dropdown from moving during transitions
								pointerEvents: isTransitioning ? "none" : "auto",
							}}
						>
							<SidebarUserMenu preloadedUser={preloadedUser} />
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarGroupContent>
			</SidebarGroup>
		</SidebarFooter>
	);
}
