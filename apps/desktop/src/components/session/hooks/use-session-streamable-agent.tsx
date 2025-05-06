import { useMemo } from "react";
import {
  SESSION_CHAT_V1_API_URL,
  SESSION_CHAT_V1_AUTO_RESUME,
} from "@/constants/chat";
import { convertDBMessageToUIMessage, DBMessage } from "@/types/internal";
import { useChat } from "@ai-sdk/react";

import { nanoid } from "@repo/lib";

import { useSessionResumable } from "./use-session-resumable";

interface UseSessionChatV1Props {
  workspaceId: string;
  sessionId: string | null;
  initialMessages?: DBMessage[];
  autoResume?: boolean;
}

export function useSessionStreamableAgent({
  workspaceId,
  sessionId,
  initialMessages = [],
  autoResume = SESSION_CHAT_V1_AUTO_RESUME,
}: UseSessionChatV1Props) {
  const id = useMemo(() => nanoid(), [sessionId, workspaceId]);

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    status,
    error,
    experimental_resume,
    append,
    addToolResult,
  } = useChat({
    id,
    api: SESSION_CHAT_V1_API_URL,
    initialMessages: initialMessages.map(convertDBMessageToUIMessage),
    generateId: () => nanoid(),
    sendExtraMessageFields: true,
    experimental_streamMode: "words",
    experimental_prepareRequestBody: (body) => ({
      message: body.messages.at(-1),
      id,
      workspaceId,
      sessionId: sessionId ?? body.id, // @IMPORTANT we pass the body.id as inference to create the sesssion if doesn't exists...
    }),
    onError: (err) => {
      // @TODO Proper handling of errors on client-side...
      console.error("Chat Error:", err);
      // Resetting execution state is now handled within useBlenderCodeExecutor
    },
    onFinish: () => {
      // window.history.replaceState({}, "", `/search/${id}`);
    },
    experimental_throttle: 100,
  });

  console.log("messages", messages);

  // Find the latest assistant message to pass to the executor hook
  // const latestAssistantMessage = useLatestAssistantMessage(messages);

  // // Use the new hook, passing the latest assistant message
  // const { isExecuting, executionResult, dismissExecutionResult } =
  //   useBlenderCodeExecutor({ message: latestAssistantMessage });

  // Use the new resumable hook
  useSessionResumable({ autoResume, sessionId, experimental_resume });

  return {
    messages,
    input,
    setInput,
    handleSubmit,
    status, // Overall chat status
    error, // Chat error
    isLoading: status === "submitted" || status === "streaming",
    // Use the state returned from the new hook
    // testResult: executionResult,
    // handleDismissTestResult: dismissExecutionResult,
    // executingCode: isExecuting,
    experimental_resume,
    append,
    addToolResult,
  };
}
