"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@repo/ui/components/ui/button";
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
		<aside className="w-48 flex-shrink-0">
			<nav className="space-y-0.5">
				{accountNavigation.map((item) => {
					const href = `/account/settings/${item.path}`;
					const isActive = pathname === href;

					return (
						<Button
							key={item.name}
							variant="ghost"
							size="sm"
							asChild
							className={cn(
								"w-full justify-start font-normal",
								isActive
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground hover:text-foreground",
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
