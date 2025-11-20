"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";

const accountNavigation = [
	{
		name: "General",
		path: "general",
	},
	{
		name: "Sources",
		path: "sources",
	},
	{
		name: "API Key",
		path: "api-key",
	},
];

export function AccountSettingsSidebar() {
	const pathname = usePathname();

	return (
		<aside className="w-64 flex-shrink-0">
			<nav className="space-y-1">
				{accountNavigation.map((item) => {
					const href = `/account/settings/${item.path}`;
					const isActive = pathname === href;

					return (
						<Link
							key={item.name}
							href={href}
							prefetch={true}
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
