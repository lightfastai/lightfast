import type { UIMessage } from "ai";

interface HandleStreamFinishParams {
  responseMessages: UIMessage[];
  sessionId: string;
}

export async function handleStreamFinish({
  responseMessages,
  sessionId,
}: HandleStreamFinishParams) {}
