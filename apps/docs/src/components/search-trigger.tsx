"use client";

import { Button } from "@repo/ui/components/ui/button";
import { useSearchContext } from "fumadocs-ui/provider";

export function SearchTrigger() {
	const { setOpenSearch } = useSearchContext();

	return (
		<Button
			variant="outline"
			size="xs"
			className="relative h-9 w-9 p-0 xl:h-9 xl:w-80 xl:justify-start xl:px-3 xl:py-2 border-border/50"
			onClick={() => setOpenSearch(true)}
		>
			<span className="hidden xl:inline-flex text-muted-foreground/50 text-xs">
				Search documentation...
			</span>
			<div className="pointer-events-none absolute right-1.5 hidden h-6 select-none items-center gap-1 font-mono text-xs font-medium opacity-100 xl:flex">
				<kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-xs">
					⌘
				</kbd>
				<kbd className="px-1.5 py-0.5 rounded border border-border bg-background text-xs">
					K
				</kbd>
			</div>
		</Button>
	);
}
