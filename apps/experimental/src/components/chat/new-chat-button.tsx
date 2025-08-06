"use client";

import { Icons } from "@repo/ui/components/icons";
import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";

interface NewChatButtonProps {
	variant?: "default" | "mobile";
	href?: string;
}

export function NewChatButton({ variant = "default", href = "/" }: NewChatButtonProps) {
	if (variant === "mobile") {
		return (
			<Button variant="ghost" size="icon" asChild className="h-8 w-8">
				<Link href={href}>
					<Icons.newChat className="h-4 w-4" />
				</Link>
			</Button>
		);
	}

	return (
		<Button variant="ghost" size="icon" asChild>
			<Link href={href}>
				<Icons.newChat className="h-4 w-4" />
			</Link>
		</Button>
	);
}
