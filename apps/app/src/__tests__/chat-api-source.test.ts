import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");
const repoRoot = resolve(appRoot, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

function repoSource(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

describe("app chat API route migration", () => {
  it("serves the workspace assistant POST endpoint through a TanStack server route", () => {
    const routeSource = source("src/routes/api/chat.ts");
    const packageJson = JSON.parse(repoSource("api/app/package.json")) as {
      exports: Record<string, unknown>;
    };

    expect(packageJson.exports).toHaveProperty(
      "./internal-api/workspace-assistant"
    );
    expect(routeSource).toContain('createFileRoute("/api/chat")');
    expect(routeSource).toContain("@api/app/internal-api/workspace-assistant");
    expect(routeSource).toContain("handleWorkspaceAssistantChatRequest");
    expect(routeSource).toContain("POST: async ({ request })");
    expect(routeSource).not.toContain("~/server/chat");
    expect(routeSource).not.toContain("next/");
  });

  it("serves the resumable stream endpoint through a TanStack dynamic server route", () => {
    const routeSource = source("src/routes/api/chat/$id/stream.ts");

    expect(routeSource).toContain('createFileRoute("/api/chat/$id/stream")');
    expect(routeSource).toContain("@api/app/internal-api/workspace-assistant");
    expect(routeSource).toContain("handleWorkspaceAssistantStreamRequest");
    expect(routeSource).toContain("GET: async ({ request, params })");
    expect(routeSource).toContain("params.id");
    expect(routeSource).not.toContain("~/server/chat");
    expect(routeSource).not.toContain("next/");
  });

  it("keeps the workspace assistant chat backend in api/app", () => {
    const chatSource = repoSource(
      "api/app/src/adapters/internal/workspace-assistant/chat-route.ts"
    );
    const streamSource = repoSource(
      "api/app/src/adapters/internal/workspace-assistant/stream-route.ts"
    );
    const resumableSource = repoSource(
      "api/app/src/adapters/internal/workspace-assistant/resumable-stream.ts"
    );

    for (const removedPath of [
      "src/server/chat/auth.ts",
      "src/server/chat/org-setup-gate.ts",
      "src/server/chat/resumable-stream.ts",
      "src/server/chat/workspace-assistant-route.ts",
      "src/server/chat/workspace-assistant-stream-route.ts",
      "src/server/log.ts",
    ]) {
      expect(existsSync(resolve(appRoot, removedPath)), removedPath).toBe(
        false
      );
    }

    expect(chatSource).toContain("resolveIdentityFromClerk");
    expect(chatSource).toContain("safeValidateUIMessages");
    expect(chatSource).toContain("streamText");
    expect(chatSource).toContain("toUIMessageStreamResponse");
    expect(chatSource).toContain('await import("../../../services/skills")');
    expect(chatSource).toContain(
      "setWorkspaceAssistantConversationActiveStream"
    );
    expect(chatSource).toContain("createWorkspaceAssistantTools");
    expect(chatSource).toContain(
      "createWorkspaceAssistantProviderRoutineToolDefinitions"
    );
    expect(chatSource).toContain(
      "createWorkspaceAssistantUserConnectorToolDefinitions"
    );
    expect(streamSource).toContain("resumeExistingStream");
    expect(streamSource).toContain("UI_MESSAGE_STREAM_HEADERS");
    expect(resumableSource).toContain("createResumableStreamContext");
    expect(resumableSource).toContain("waitUntil");

    for (const nextFreeSource of [chatSource, streamSource, resumableSource]) {
      expect(nextFreeSource).not.toContain("next/");
      expect(nextFreeSource).not.toContain("server-only");
      expect(nextFreeSource).not.toContain('from "~/app/(chat)');
      expect(nextFreeSource).not.toContain('from "~/server');
      expect(nextFreeSource).not.toContain("@vendor/observability/log/next");
      expect(nextFreeSource).not.toContain("@api/app/auth/identity");
      expect(nextFreeSource).not.toContain("@api/app/services/");
    }
    expect(chatSource).not.toContain('from "@api/app/services/skills"');
  });
});
