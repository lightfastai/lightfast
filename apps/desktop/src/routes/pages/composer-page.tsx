import React from "react";
import { ComposerRootLayout } from "@/components/composer-root-layout";
import { BlenderStatusIndicator } from "@/components/connection-indicators/blender-status-indicator";
import { ArrowUp } from "lucide-react";

import { Textarea } from "@repo/ui/components/ui/textarea";

const ComposerPage: React.FC = () => {
  // TODO: Wire up workspaceId/sessionId as needed for your domain
  const workspaceId = "composer-workspace"; // Placeholder
  const sessionId = null; // Placeholder (could be generated or routed)
  const session = {
    name: "We are building the parthenon",
  };
  const fakeSessions = [
    { id: "1", title: "Build the Parthenon", updatedAt: new Date() },
    { id: "2", title: "Brainstorm UI ideas", updatedAt: new Date() },
    { id: "3", title: "Refactor codebase", updatedAt: new Date() },
  ];
  return (
    <ComposerRootLayout>
      <div className="flex h-full flex-col items-center justify-center gap-2 px-4 pt-16 pb-4">
        <header className="flex w-full items-center justify-between">
          <h1 className="text-muted-foreground/70 bg-muted-foreground/10 rounded-md border p-1 font-mono text-xs text-[0.65rem] font-bold">
            {session.name}
          </h1>
          {/* Add action buttons here if needed */}
          <BlenderStatusIndicator />
        </header>
        <main className="flex w-full flex-1 flex-col gap-2">
          {/* Main composer orchestrator (chat, code, etc.) */}
          <div className="relative flex h-full w-full flex-col items-end justify-between">
            <div className="relative w-full">
              <Textarea
                placeholder="Send a message..."
                className="w-full resize-none pr-16 pb-10 text-sm"
              />
              <button
                type="submit"
                disabled
                className="border-border hover:bg-accent bg-muted-foreground/10 absolute right-2 bottom-2 flex h-6 items-center justify-center rounded-full border p-1 text-xs"
              >
                <ArrowUp className="text-muted-foreground/70 size-3" />
              </button>
            </div>
            {/* Fake past chats list below main area */}
            <div className="mt-8 flex w-full flex-col gap-2">
              <div className="text-muted-foreground/70 font-mono text-[0.65rem]">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-muted-foreground/70 font-mono text-xs">
                    Past Chats
                  </div>
                  <div className="text-muted-foreground/70 font-mono text-xs">
                    View All
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {fakeSessions.map((session) => (
                  <div
                    className="flex w-full items-center justify-between"
                    key={session.id}
                  >
                    <div className="text-muted-foreground font-mono text-xs">
                      {session.title}
                    </div>
                    <div className="text-muted-foreground font-mono text-xs">
                      {Math.floor(
                        (new Date().getTime() - session.updatedAt.getTime()) /
                          (1000 * 60),
                      )}{" "}
                      min ago
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Optional: Tool panel (e.g., BlenderMCP) */}
          {/* <BlenderMCP /> */}
        </main>
      </div>
    </ComposerRootLayout>
  );
};

export default ComposerPage;
