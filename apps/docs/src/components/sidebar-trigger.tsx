"use client";

import { Menu } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { useSidebar } from "fumadocs-ui/provider";

export function SidebarTrigger() {
	const { open, setOpen } = useSidebar();

	return (
		<Button
			variant="ghost"
			size="xs"
			onClick={() => setOpen(!open)}
			aria-label="Toggle Sidebar"
		>
			<Menu className="h-4 w-4" />
		</Button>
	);
}