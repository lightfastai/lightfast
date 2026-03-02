"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

interface NavItem {
	name: string;
	path: string;
}

interface SettingsSidebarProps {
	basePath: string;
	items: NavItem[];
}

export function SettingsSidebar({ basePath, items }: SettingsSidebarProps) {
	const pathname = usePathname();

	return (
		<aside className="w-48 flex-shrink-0">
			<nav className="space-y-0.5">
				{items.map((item) => {
					const href = item.path
						? `${basePath}/${item.path}`
						: basePath;
					const isActive = pathname === href;

					return (
						<Button
							key={item.name}
							variant="ghost"
							size="sm"
							asChild
							className={cn(
								"w-full justify-start font-normal rounded-lg",
								isActive
									? "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent dark:hover:bg-sidebar-accent font-medium"
									: "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
							)}
						>
							<Link href={href} prefetch={true}>
								{item.name}
							</Link>
						</Button>
					);
				})}
			</nav>
		</aside>
	);
}
