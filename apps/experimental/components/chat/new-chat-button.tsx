"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface NewChatButtonProps {
	variant?: "default" | "mobile";
	href?: string;
}

export function NewChatButton({ variant = "default", href = "/" }: NewChatButtonProps) {
	if (variant === "mobile") {
		return (
			<Button variant="outline" size="icon" asChild className="h-8 w-8">
				<Link href={href}>
					<Plus className="h-4 w-4" />
				</Link>
			</Button>
		);
	}

	return (
		<Button variant="outline" size="sm" asChild className="h-8 gap-1">
			<Link href={href}>
				<Plus className="h-4 w-4" />
				<span>New Chat</span>
			</Link>
		</Button>
	);
}
