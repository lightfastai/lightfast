"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface NewChatButtonProps {
	variant?: "default" | "mobile";
}

export function NewChatButton({ variant = "default" }: NewChatButtonProps) {
	const router = useRouter();

	const handleNewChat = () => {
		router.push("/");
	};

	if (variant === "mobile") {
		return (
			<Button variant="outline" size="icon" onClick={handleNewChat} className="h-8 w-8">
				<Plus className="h-4 w-4" />
			</Button>
		);
	}

	return (
		<Button variant="outline" size="sm" onClick={handleNewChat} className="h-8 gap-1">
			<Plus className="h-4 w-4" />
			<span>New Chat</span>
		</Button>
	);
}
