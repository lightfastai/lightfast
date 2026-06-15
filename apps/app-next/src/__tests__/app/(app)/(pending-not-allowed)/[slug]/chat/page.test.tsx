import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let nextConversationId = 0;
let receivedProps: { conversationId?: string } = {};

vi.mock("@db/app", () => ({
  createWorkspaceAssistantConversationId: () =>
    `conv_test_${++nextConversationId}`,
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client",
  () => ({
    WorkspaceAssistantClient: (props: { conversationId: string }) => {
      receivedProps = props;
      return <div>Workspace assistant client</div>;
    },
  })
);

const { default: ChatPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/chat/page"
);

beforeEach(() => {
  nextConversationId = 0;
  receivedProps = {};
});

describe("workspace chat page", () => {
  it("renders the assistant with a fresh addressable conversation id", () => {
    render(ChatPage());

    expect(screen.getByText("Workspace assistant client")).toBeVisible();
    expect(receivedProps.conversationId).toBe("conv_test_1");
  });

  it("generates a distinct conversation id per request", () => {
    render(ChatPage());
    const first = receivedProps.conversationId;
    render(ChatPage());
    const second = receivedProps.conversationId;

    expect(first).not.toBe(second);
  });
});
