import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("workspace assistant client", () => {
  it("creates a conversation before navigating to its detail URL", () => {
    const clientSource = source("src/chat/workspace-assistant-client.tsx");
    const createConversationIndex = clientSource.indexOf(
      "await createConversation.mutateAsync"
    );
    const detailUrlIndex = clientSource.indexOf(
      "replaceBrowserChatUrl(params.slug, conversationId)"
    );
    const sendMessageIndex = clientSource.indexOf("await sendMessage");

    expect(createConversationIndex).toBeGreaterThan(-1);
    expect(detailUrlIndex).toBeGreaterThan(createConversationIndex);
    expect(sendMessageIndex).toBeGreaterThan(createConversationIndex);
    expect(detailUrlIndex).toBeGreaterThan(sendMessageIndex);
  });
});
