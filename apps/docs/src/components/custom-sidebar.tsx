"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PageTree } from "fumadocs-core/server";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/components/ui/button";
import { ScrollArea } from "@repo/ui/components/ui/scroll-area";

interface CustomSidebarProps {
	tree?: PageTree.Root;
	className?: string;
}

export function CustomSidebar({ tree, className }: CustomSidebarProps) {
	const pathname = usePathname();

	if (!tree) return null;

	return (
		<aside
			className={cn("max-lg:hidden w-64 py-4 h-full bg-background", className)}
		>
			<ScrollArea className="h-full">
				<nav className="px-4 lg:px-6">
					<div className="space-y-4">
						{tree.children.map((item, index) => (
							<div key={item.$id ?? `item-${index}`} className="space-y-2">
								<div className="text-xs font-semibold px-3 text-muted-foreground tracking-wider">
									{item.name}
								</div>
								{item.type === "folder" && (
									<div className="space-y-1">
										{item.children.map((page) => {
											if (page.type !== "page") return null;

											const isActive = page.url === pathname;

											return (
												<Button
													key={page.url}
													variant={isActive ? "secondary" : "ghost"}
													size="sm"
													className={cn(
														"w-full justify-start text-xs",
														isActive && "font-medium",
													)}
													asChild
												>
													<Link href={page.url}>{page.name}</Link>
												</Button>
											);
										})}
									</div>
								)}
							</div>
						))}
					</div>
				</nav>
			</ScrollArea>
		</aside>
	);
}
