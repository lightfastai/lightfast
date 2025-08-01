"use client";

import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/ui/popover";

export function ExperimentalBadge() {
	return (
		<div className="flex items-center gap-1 mb-2">
			<h1 className="font-mono text-xs text-muted-foreground">Experimental</h1>
			<Popover>
				<PopoverTrigger asChild>
					<button type="button" className="hover:opacity-70 transition-opacity">
						<Info className="h-3 w-3 text-muted-foreground" />
					</button>
				</PopoverTrigger>
				<PopoverContent side="right" className="w-80">
					<p className="text-sm">
						This is an experiment. What you see here is not an end product. It is bound to break.
					</p>
				</PopoverContent>
			</Popover>
		</div>
	);
}
