import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ChatLayout } from "@/components/chat/chat-layout";

interface AgentLayoutProps {
	children: ReactNode;
	params: Promise<{
		agentId: string;
	}>;
}

export default async function AgentLayout({ children, params }: AgentLayoutProps) {
	const { agentId } = await params;

	// Validate agentId is a valid type
	const validAgentIds: string[] = ["a010", "a011"];
	if (!validAgentIds.includes(agentId)) {
		notFound();
	}

	return <ChatLayout agentId={agentId}>{children}</ChatLayout>;
}
