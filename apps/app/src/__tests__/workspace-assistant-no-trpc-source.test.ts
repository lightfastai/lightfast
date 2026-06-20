import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const assistantAdapterImport = /from\s+["']@api\/app\/tanstack\/assistant["']/;

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("migrated workspace assistant data access", () => {
  it("uses TanStack server functions instead of tRPC in app consumers", () => {
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

    expect(
      existsSync(resolve(appRoot, "src/chat/workspace-assistant-queries.ts"))
    ).toBe(false);

    for (const fileSource of [
      sidebarSource,
      recentChatsMenuSource,
      clientSource,
      conversationRouteSource,
    ]) {
      expect(fileSource).not.toContain("useTRPC");
      expect(fileSource).not.toContain("trpc.org.workspace.assistant");
      expect(fileSource).not.toContain("AppRouterOutputs");
    }

    expect(recentChatsMenuSource).toContain("listConversations");
    expect(recentChatsMenuSource).toContain(
      '"workspace-assistant",\n      "conversations",\n      orgSlug,\n      recentChatsInput'
    );
    expect(clientSource).toContain("createConversation");
    expect(clientSource).toContain(
      '["workspace-assistant", "conversations"] as const'
    );
    expect(clientSource).not.toContain("assistantConversationQueryKey");
    expect(clientSource).not.toContain("setQueryData");
    expect(newConversationRouteSource).toContain(
      'from "~/chat/conversation-id"'
    );
    expect(newConversationRouteSource).not.toMatch(assistantAdapterImport);
    expect(newConversationRouteSource).toContain(
      "createWorkspaceAssistantConversationId"
    );
    expect(newConversationRouteSource).not.toContain("createServerFn");
    expect(newConversationRouteSource).not.toContain("@db/app");
    expect(conversationRouteSource).toContain("getConversation");
    expect(conversationRouteSource).toContain("useQuery");
    expect(conversationRouteSource).toContain(
      '["workspace-assistant", "conversation", conversationId] as const'
    );
    expect(conversationRouteSource).not.toContain("loader:");
    expect(conversationRouteSource).not.toContain("Route.useLoaderData()");
    expect(conversationRouteSource).not.toContain(
      "assistantConversationQueryKey"
    );
    expect(conversationRouteSource).not.toContain(
      "workspace-assistant-queries"
    );
    expect(conversationRouteSource).not.toContain(
      "assistantConversationQueryOptions"
    );
  });
});
