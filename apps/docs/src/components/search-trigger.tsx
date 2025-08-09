"use client";

import { SearchIcon } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { useSearchContext } from "fumadocs-ui/provider";

export function SearchTrigger() {
	const { setOpenSearch } = useSearchContext();

	return (
		<Button
			variant="outline"
			size="sm"
			className="relative h-9 w-9 p-0 xl:h-9 xl:w-80 xl:justify-start xl:px-3 xl:py-2 border-border dark:border-border"
			onClick={() => setOpenSearch(true)}
		>
			<SearchIcon className="h-4 w-4 xl:mr-2" />
			<span className="hidden xl:inline-flex text-muted-foreground text-sm">
				Search documentation...
			</span>
			<kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs font-medium opacity-100 xl:flex">
				<span className="text-xs">⌘</span>K
			</kbd>
		</Button>
	);
}
