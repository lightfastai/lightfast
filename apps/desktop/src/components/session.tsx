import React, { useEffect } from "react";
import {
  SESSION_CHAT_API_URL,
  SESSION_CHAT_AUTO_RESUME,
} from "@/config/session-constants";
import { trpc } from "@/trpc";
import { useChat } from "@ai-sdk/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { HistoryIcon, Plus } from "lucide-react";

import { nanoid } from "@repo/lib";
import { Button } from "@repo/ui/components/ui/button";
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
  const [showPastSessions, setShowPastSessions] = React.useState(false);

  const {
    messages,
    input,
    setInput,
    handleSubmit,
    status,
    error,
    experimental_resume,
    addToolResult,
  } = useChat({
    id: sessionId,
    api: SESSION_CHAT_API_URL,
    initialMessages: session?.messages,
    generateId: () => nanoid(),
    sendExtraMessageFields: true,
    experimental_streamMode: "words",
    experimental_prepareRequestBody: (body) => ({
      message: body.messages.at(-1),
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
        <h1
          className={cn(
            "text-muted-foreground bg-muted-foreground/10 h-6 min-w-20 rounded-md border px-3 py-1 font-mono text-[0.65rem] font-bold",
            !session?.title && status === "submitted" && "animate-pulse",
          )}
        >
          {session?.title
            ? session?.title
            : status === "ready"
              ? "New Chat"
              : "Thinking..."}
        </h1>
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
      <main className="flex w-full flex-1 flex-col gap-2">
        <div className="relative flex h-full w-full flex-col items-end justify-between">
          <div className={cn("bg-background flex h-full w-full flex-col")}>
            <div className="flex h-full w-full flex-col items-center">
              {!messages || messages.length === 0 ? (
                <div className="w-full">
                  <UserMessageInput
                    input={input}
                    setInput={setInput}
                    handleSubmit={handleSubmit}
                    className="w-full"
                    status={"ready"}
                  />
                </div>
              ) : (
                <>
                  <div className="w-full flex-1 overflow-hidden">
                    <MessageList
                      messages={messages || []}
                      status={status}
                      error={error || null}
                      className="w-full"
                      addToolResult={addToolResult}
                      input={input}
                      setInput={setInput}
                      handleSubmit={handleSubmit}
                      stop={undefined}
                      setMessages={undefined}
                    />
                    <div>
                      <UserMessageInput
                        key={nanoid()}
                        input={input}
                        setInput={setInput}
                        status={"ready"}
                        stop={undefined}
                        handleSubmit={handleSubmit}
                        setMessages={undefined}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          {messages.length === 0 && (
            <div className="flex w-full items-center justify-center">
              <PastSessions sessions={sessions} />
            </div>
          )}
        </div>
        {/* Optional: Tool panel (e.g., BlenderMCP) */}
        {/* <BlenderMCP /> */}
      </main>
    </div>
  );
};
