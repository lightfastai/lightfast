"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function NewChatButton() {
	const router = useRouter();

	const handleNewChat = () => {
		router.push("/");
	};

	return (
		<Button variant="outline" size="sm" onClick={handleNewChat} className="h-8 gap-1">
			<Plus className="h-4 w-4" />
			<span>New Chat</span>
		</Button>
	);
}