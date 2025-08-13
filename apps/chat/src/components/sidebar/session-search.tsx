"use client";

import { Input } from "@repo/ui/components/ui/input";
import { SearchIcon, XIcon } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { cn } from "@repo/ui/lib/utils";

interface SessionSearchProps {
	value: string;
	onChange: (value: string) => void;
	onClear: () => void;
	placeholder?: string;
	className?: string;
}

export function SessionSearch({ 
	value, 
	onChange, 
	onClear, 
	placeholder = "Search sessions...",
	className 
}: SessionSearchProps) {
	return (
		<div className={cn("relative", className)}>
			<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
			<Input
				type="text"
				placeholder={placeholder}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="pl-9 pr-9 h-9 bg-background/50"
			/>
			{value && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={onClear}
					className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-transparent"
				>
					<XIcon className="h-3.5 w-3.5 text-muted-foreground" />
					<span className="sr-only">Clear search</span>
				</Button>
			)}
		</div>
	);
}