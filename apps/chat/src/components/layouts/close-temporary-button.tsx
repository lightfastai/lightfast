"use client";

import { Button } from "@repo/ui/components/ui/button";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@repo/ui/lib/utils";

interface CloseTemporaryButtonProps {
	className?: string;
}

export function CloseTemporaryButton({ className }: CloseTemporaryButtonProps) {
	const router = useRouter();

	const button = (
		<Button
			type="button"
			variant="ghost"
			aria-label="Close temporary chat"
			onClick={() => router.replace("/new")}
			className={cn(
				"h-8 w-8 px-0 py-0 flex items-center text-muted justify-center",
				className,
			)}
		>
			<X className="h-4 w-4" aria-hidden="true" />
		</Button>
	);

	return (
		<Tooltip>
			<TooltipTrigger asChild>{button}</TooltipTrigger>
			<TooltipContent side="bottom" align="end">
				Close temporary chat
			</TooltipContent>
		</Tooltip>
	);
}
