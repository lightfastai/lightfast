"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";

const settingsNavigation = [
	{
		name: "Data Controls",
		path: "data-controls",
	},
	{
		name: "Environments",
		path: "environments",
	},
];

interface SettingsSidebarProps {
	orgSlug: string;
}

export function SettingsSidebar({ orgSlug }: SettingsSidebarProps) {
	const pathname = usePathname();

	return (
		<aside className="w-64 flex-shrink-0">
			<nav className="space-y-1">
				{settingsNavigation.map((item) => {
					const href = `/org/${orgSlug}/settings/${item.path}`;
					const isActive = pathname === href;

					return (
						<Link
							key={item.name}
							href={href}
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
