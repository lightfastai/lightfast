import { Info } from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@repo/ui/components/ui/popover";

export function PlaygroundBadge() {
	return (
		<div className="flex items-center gap-1 mb-2">
			<h1 className="font-mono text-xs text-muted-foreground">Playground</h1>
			<Popover>
				<PopoverTrigger asChild>
					<button type="button" className="hover:opacity-70 transition-opacity">
						<Info className="h-3 w-3 text-muted-foreground" />
					</button>
				</PopoverTrigger>
				<PopoverContent side="right" className="w-80">
					<p className="text-sm">
						This is the Lightfast playground. Test and experiment with AI agent
						capabilities in a safe environment.
					</p>
				</PopoverContent>
			</Popover>
		</div>
	);
}

