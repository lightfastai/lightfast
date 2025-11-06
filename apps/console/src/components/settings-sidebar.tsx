"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";

const settingsNavigation = [
	{
		name: "GitHub Integration",
		path: "github-integration",
	},
	{
		name: "Repositories",
		path: "repositories",
	},
];

interface SettingsSidebarProps {
	slug: string;
}

export function SettingsSidebar({ slug }: SettingsSidebarProps) {
	const pathname = usePathname();

	return (
		<aside className="w-64 flex-shrink-0">
			<nav className="space-y-1">
				{settingsNavigation.map((item) => {
					const href = `/org/${slug}/settings/${item.path}`;
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
