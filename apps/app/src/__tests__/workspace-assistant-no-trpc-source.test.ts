import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const assistantAdapterImport = /from\s+["']@api\/app\/tanstack\/assistant["']/;

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("migrated workspace assistant data access", () => {
  it("uses TanStack server functions instead of tRPC in app consumers", () => {
    const queryHelperSource = source("src/chat/workspace-assistant-queries.ts");
    const sidebarSource = source("src/components/app-sidebar.tsx");
    const recentChatsMenuSource = source(
      "src/components/recent-chats-menu.tsx"
    );
    const clientSource = source("src/chat/workspace-assistant-client.tsx");
    const newConversationRouteSource = source(
      "src/routes/_authenticated/$slug/chat/index.tsx"
    );
    const conversationRouteSource = source(
      "src/routes/_authenticated/$slug/chat/$conversationId.tsx"
    );

    expect(queryHelperSource).toMatch(assistantAdapterImport);
    expect(queryHelperSource).toContain("assistantConversationsQueryOptions");
    expect(queryHelperSource).toContain("assistantConversationQueryOptions");

    for (const fileSource of [
      queryHelperSource,
      sidebarSource,
      recentChatsMenuSource,
      clientSource,
      conversationRouteSource,
    ]) {
      expect(fileSource).not.toContain("useTRPC");
      expect(fileSource).not.toContain("trpc.org.workspace.assistant");
      expect(fileSource).not.toContain("AppRouterOutputs");
    }

    expect(recentChatsMenuSource).toContain(
      "assistantConversationsQueryOptions"
    );
    expect(clientSource).toContain("createConversation");
    expect(clientSource).toContain("assistantConversationsQueryKey");
    expect(newConversationRouteSource).toMatch(assistantAdapterImport);
    expect(newConversationRouteSource).toContain(
      "createNewWorkspaceAssistantConversationId"
    );
    expect(newConversationRouteSource).not.toContain("createServerFn");
    expect(newConversationRouteSource).not.toContain("@db/app");
    expect(conversationRouteSource).toContain(
      "assistantConversationQueryOptions"
    );
  });
});
