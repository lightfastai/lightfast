import { Info } from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "./ui/popover";

interface AppBadgeProps {
	title: string;
	description: string;
}

export function AppBadge({ title, description }: AppBadgeProps) {
	return (
		<div className="flex items-center gap-1 mb-2">
			<h1 className="font-mono text-xs text-muted-foreground">{title}</h1>
			<Popover>
				<PopoverTrigger asChild>
					<button type="button" className="hover:opacity-70 transition-opacity">
						<Info className="h-3 w-3 text-muted-foreground" />
					</button>
				</PopoverTrigger>
				<PopoverContent side="right" className="w-80">
					<p className="text-sm">{description}</p>
				</PopoverContent>
			</Popover>
		</div>
	);
}