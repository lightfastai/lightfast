import type { UseChatHelpers } from "@ai-sdk/react";
import type { LightfastUIMessage } from "@lightfast/types";
import { useEffect, useRef } from "react";
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
		if (autoResume) {
			// resumeStream should use the transport's API endpoint
			// The transport configuration handles the URL construction
			resumeStream();
		}
		// We want to disable the exhaustive deps rule here because we only want to run this effect once
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!dataStream) return;
		if (dataStream.length === 0) return;

		const dataPart = dataStream[0];

		if (dataPart && dataPart.type === "data-appendMessage") {
			const message = JSON.parse(dataPart.data as string);
			setMessages([...initialMessages, message]);
		}
	}, [dataStream, initialMessages, setMessages]);
}
