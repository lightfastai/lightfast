import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("app chat API route migration", () => {
  it("serves the workspace assistant POST endpoint through a TanStack server route", () => {
    const routeSource = source("src/routes/api/chat.ts");

    expect(routeSource).toContain('createFileRoute("/api/chat")');
    expect(routeSource).toContain("handleWorkspaceAssistantChatRequest");
    expect(routeSource).toContain("POST: async ({ request })");
    expect(routeSource).not.toContain("next/");
  });

  it("serves the resumable stream endpoint through a TanStack dynamic server route", () => {
    const routeSource = source("src/routes/api/chat/$id/stream.ts");

    expect(routeSource).toContain('createFileRoute("/api/chat/$id/stream")');
    expect(routeSource).toContain("handleWorkspaceAssistantStreamRequest");
    expect(routeSource).toContain("GET: async ({ request, params })");
    expect(routeSource).toContain("params.id");
    expect(routeSource).not.toContain("next/");
  });

  it("ports the Next chat runtime without framework-specific server APIs", () => {
    const chatSource = source("src/server/chat/workspace-assistant-route.ts");
    const streamSource = source(
      "src/server/chat/workspace-assistant-stream-route.ts"
    );
    const resumableSource = source("src/server/chat/resumable-stream.ts");
    const packageSource = source("package.json");

    expect(chatSource).toContain("resolveWorkspaceAssistantAuthContext");
    expect(chatSource).toContain("safeValidateUIMessages");
    expect(chatSource).toContain("streamText");
    expect(chatSource).toContain("toUIMessageStreamResponse");
    expect(chatSource).toContain('await import("@api/app/services/skills")');
    expect(chatSource).toContain(
      "setWorkspaceAssistantConversationActiveStream"
    );
    expect(chatSource).toContain(
      "createWorkspaceAssistantProviderRoutineTools"
    );
    expect(streamSource).toContain("resumeExistingStream");
    expect(streamSource).toContain("UI_MESSAGE_STREAM_HEADERS");
    expect(resumableSource).toContain("createResumableStreamContext");
    expect(resumableSource).toContain("waitUntil");

    for (const nextFreeSource of [chatSource, streamSource, resumableSource]) {
      expect(nextFreeSource).not.toContain("next/");
      expect(nextFreeSource).not.toContain("server-only");
      expect(nextFreeSource).not.toContain('from "~/app/(chat)');
      expect(nextFreeSource).not.toContain("@vendor/observability/log/next");
      expect(nextFreeSource).not.toContain("@api/app/auth/identity");
    }
    expect(chatSource).not.toContain('from "@api/app/services/skills"');
    expect(packageSource).not.toContain('"@vendor/observability"');
  });
});
