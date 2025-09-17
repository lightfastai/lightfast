"use client";

import { useTheme } from "next-themes";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@repo/ui/components/ui/select";
import { useEffect, useState } from "react";

export function GeneralTab() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	// Avoid hydration mismatch
	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<span className="text-xs font-medium">Theme</span>
					<Select disabled>
						<SelectTrigger className="w-24 h-8 text-xs">
							<SelectValue placeholder="Loading..." />
						</SelectTrigger>
					</Select>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<span className="text-xs font-medium">Theme</span>
				<Select value={theme} onValueChange={setTheme}>
					<SelectTrigger className="w-24 h-8 text-xs">
						<SelectValue placeholder="Select theme" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="light">Light</SelectItem>
						<SelectItem value="dark">Dark</SelectItem>
						<SelectItem value="system">System</SelectItem>
					</SelectContent>
				</Select>
			</div>
		</div>
	);
}