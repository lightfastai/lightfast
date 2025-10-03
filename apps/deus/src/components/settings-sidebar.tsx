"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";

const settingsNavigation = [
	{
		name: "Data Controls",
		href: "/settings/data-controls",
	},
	{
		name: "Environments",
		href: "/settings/environments",
	},
];

export function SettingsSidebar() {
	const pathname = usePathname();

	return (
		<aside className="w-64 flex-shrink-0">
			<nav className="space-y-1">
				{settingsNavigation.map((item) => {
					const isActive = pathname === item.href;

					return (
						<Link
							key={item.name}
							href={item.href}
							className={cn(
								"block rounded-md px-3 py-2 text-sm font-medium transition-colors",
								isActive
									? "bg-foreground/10 text-foreground"
									: "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
							)}
						>
							{item.name}
						</Link>
					);
				})}
			</nav>
		</aside>
	);
}
