import { auth } from "@clerk/nextjs/server";
import type { ExperimentalAgentId } from "@lightfast/types";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ChatLayout } from "@/components/chat/chat-layout";

interface AgentLayoutProps {
	children: ReactNode;
	params: Promise<{
		agentId: ExperimentalAgentId;
	}>;
}

export default async function AgentLayout({ children, params }: AgentLayoutProps) {
	const { agentId } = await params;

	// Single auth check for the entire agent section
	const { userId } = await auth();
	if (!userId) {
		notFound();
	}

	// Validate agentId is a valid type
	const validAgentIds: ExperimentalAgentId[] = ["a010", "a011"];
	if (!validAgentIds.includes(agentId)) {
		notFound();
	}

	return <ChatLayout agentId={agentId}>{children}</ChatLayout>;
}
