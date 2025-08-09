"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Icons } from "@repo/ui/components/icons";
import { Button } from "@repo/ui/components/ui/button";

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();

	return (
		<Button 
			variant="ghost" 
			size="xs"
			onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
		>
			<Icons.darkMode className="h-4 w-4" />
			<span className="sr-only">Toggle theme</span>
		</Button>
	);
}