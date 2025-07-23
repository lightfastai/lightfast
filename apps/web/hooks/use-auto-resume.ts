"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { LightfastUIMessage } from "@lightfast/types";
import { useEffect } from "react";
import { useDataStream } from "@/components/data-stream-provider";

export interface UseAutoResumeParams {
	autoResume: boolean;
	initialMessages: LightfastUIMessage[];
	resumeStream: UseChatHelpers<LightfastUIMessage>["resumeStream"];
	setMessages: UseChatHelpers<LightfastUIMessage>["setMessages"];
}

export function useAutoResume({ autoResume, initialMessages, resumeStream, setMessages }: UseAutoResumeParams) {
	const { dataStream } = useDataStream();

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

	// Handle data stream parts for appending messages
	// This matches Vercel's implementation
	useEffect(() => {
		if (!dataStream) return;
		if (dataStream.length === 0) return;

		const dataPart = dataStream[0];

		if (dataPart.type === "data-appendMessage") {
			const message = JSON.parse(dataPart.data as string);
			setMessages([...initialMessages, message]);
		}
	}, [dataStream, initialMessages, setMessages]);
}
