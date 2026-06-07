import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(import.meta.dirname, "../..");

function source(path: string) {
  return readFileSync(resolve(appRoot, path), "utf8");
}

describe("workspace assistant client", () => {
  it("writes the preallocated detail URL before creating the first conversation", () => {
    const clientSource = source("src/chat/workspace-assistant-client.tsx");
    const detailUrlIndex = clientSource.indexOf(
      "replaceBrowserChatUrl(orgSlug, conversationId)"
    );
    const createConversationIndex = clientSource.indexOf(
      "await createConversation.mutateAsync"
    );
    const sendMessageIndex = clientSource.indexOf("await sendMessage");

    expect(detailUrlIndex).toBeGreaterThan(-1);
    expect(createConversationIndex).toBeGreaterThan(-1);
    expect(detailUrlIndex).toBeLessThan(createConversationIndex);
    expect(sendMessageIndex).toBeGreaterThan(createConversationIndex);
  });
});
