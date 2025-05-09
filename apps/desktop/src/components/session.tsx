import React, { useEffect } from "react";
import {
  SESSION_CHAT_API_URL,
  SESSION_CHAT_AUTO_RESUME,
} from "@/config/session-constants";
import { trpc } from "@/trpc";
import { convertDBMessageToUIMessages } from "@/types/internal";
import { useChat } from "@ai-sdk/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HistoryIcon, Plus } from "lucide-react";

import { nanoid } from "@repo/lib";
import { Button } from "@repo/ui/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import { cn } from "@repo/ui/lib/utils";

import { MessageList } from "./message-list";
import { PastSessions } from "./past-sessions";
import { UserMessageInput } from "./user-message-input";

export interface SessionProps {
  sessionId: string;
}

export const Session: React.FC<SessionProps> = ({ sessionId }) => {
  const { data: session } = useQuery(
    trpc.tenant.session.get.queryOptions({ sessionId }),
  );
  const { data: sessions } = useQuery(trpc.tenant.session.list.queryOptions());

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    status,
    error,
    experimental_resume,
    addToolResult,
    stop,
    setMessages,
  } = useChat({
    id: sessionId,
    api: SESSION_CHAT_API_URL,
    initialMessages: convertDBMessageToUIMessages(session?.messages || []),
    generateId: () => nanoid(),
    sendExtraMessageFields: true,
    experimental_prepareRequestBody: (body) => ({
      message: body.messages.at(-1),
      sessionId: sessionId ?? body.id, // @IMPORTANT we pass the body.id as inference to create the sesssion if doesn't exists...
    }),
    onError: (err) => {
      // @TODO Proper handling of errors on client-side...
      console.error("Chat Error:", err);
    },
    onFinish: () => {
      // window.history.replaceState({}, "", `/search/${id}`);
    },
    experimental_throttle: 100,
  });

  const inputStatusForUserMessageInput: "ready" | "thinking" =
    status === "submitted" || status === "streaming" ? "thinking" : "ready";

  useEffect(() => {
    if (!SESSION_CHAT_AUTO_RESUME) return;
    if (sessionId && experimental_resume) {
      console.log(`Attempting to resume chat for session: ${sessionId}`);
      experimental_resume();
    }
  }, [sessionId, experimental_resume]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-4 pt-16 pb-4">
      <header className="flex w-full items-center justify-between">
        <Popover>
          <PopoverTrigger asChild>
            <h1
              className={cn(
                "text-muted-foreground bg-muted-foreground/10 h-6 max-w-64 min-w-20 cursor-default overflow-hidden rounded-md border px-3 py-1 font-mono text-[0.65rem] font-bold whitespace-nowrap",
                !session?.title && status === "submitted" && "animate-pulse",
              )}
            >
              <span className="[mask-image:linear-gradient(to_right,black_50%,transparent_95%)]">
                {session?.title
                  ? session?.title
                  : status === "ready"
                    ? "New Chat"
                    : ""}
              </span>
            </h1>
          </PopoverTrigger>
          <PopoverContent className="w-auto max-w-xs p-2 text-xs">
            {session?.title ? session.title : "New Chat"}
          </PopoverContent>
        </Popover>
        {/*   <BlenderStatusIndicator /> */}
        <div className="flex items-center gap-1">
          <Link to="/">
            <Button variant="ghost" size="xs">
              <Plus className="text-muted-foreground size-3" />
            </Button>
          </Link>
          <Button variant="ghost" size="xs">
            <HistoryIcon className="text-muted-foreground size-3" />
          </Button>
        </div>
      </header>
      <main className="flex w-full flex-1 flex-col gap-2 overflow-hidden">
        <div className="relative flex h-full w-full flex-col items-end justify-between">
          <div className={cn("bg-background flex h-full w-full flex-col")}>
            <div className="flex h-full w-full flex-col items-center">
              {/* MessageListArea: occupies most space when present */}
              {messages && messages.length > 0 && (
                <div className="w-full flex-1 overflow-y-auto">
                  <MessageList
                    messages={messages || []}
                    status={status}
                    error={error || null}
                    className="w-full"
                    addToolResult={addToolResult}
                    stop={stop}
                    setMessages={setMessages}
                  />
                </div>
              )}

              {/* UserInputArea: always present. At top if MessageListArea is not there, at bottom otherwise. */}
              <div className="w-full overflow-hidden">
                <UserMessageInput
                  input={input}
                  setInput={setInput}
                  handleSubmit={handleSubmit}
                  className="w-full"
                  status={inputStatusForUserMessageInput}
                  // Props for the main input field
                  stop={stop}
                  setMessages={setMessages}
                />
              </div>
            </div>
          </div>
          {messages.length === 0 && (
            <div className="flex w-full items-center justify-center">
              <PastSessions sessions={sessions} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
