import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

let receivedProps: { conversationId?: string } = {};

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
  receivedProps = {};
});

describe("workspace chat page", () => {
  it("renders the assistant with a fresh, addressable conversation id", () => {
    render(ChatPage());

    expect(screen.getByText("Workspace assistant client")).toBeVisible();
    // The route owns identity now: it hands the client a stable, addressable id
    // up-front so useChat never has to flip from undefined to a real id mid-send.
    expect(receivedProps.conversationId).toMatch(/^conv_/);
  });

  it("generates a distinct conversation id per request", () => {
    render(ChatPage());
    const first = receivedProps.conversationId;
    render(ChatPage());
    const second = receivedProps.conversationId;

    expect(first).not.toBe(second);
  });
});
