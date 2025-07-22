"use client";

import { useEffect } from "react";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";

export interface UseAutoResumeParams {
	autoResume: boolean;
	initialMessages: LightfastUIMessage[];
	resumeStream: UseChatHelpers<LightfastUIMessage>["resumeStream"];
	setMessages: UseChatHelpers<LightfastUIMessage>["setMessages"];
}

export function useAutoResume({
	autoResume,
	initialMessages,
	resumeStream,
	setMessages,
}: UseAutoResumeParams) {
	useEffect(() => {
		if (!autoResume) return;

		const mostRecentMessage = initialMessages.at(-1);

		// Auto-resume if the last message was from the user
		// This indicates the stream may have been interrupted
		if (mostRecentMessage?.role === "user") {
			resumeStream();
		}

		// We intentionally run this only once on mount
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
}