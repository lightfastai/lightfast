// @vitest-environment happy-dom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const clearErrorMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const listConversationsQueryFilterMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "assistant", "listConversations"],
}));
const mutateAsyncMock = vi.fn();
const routerInvalidateMock = vi.fn();
const routerNavigateMock = vi.fn();
const sendMessageMock = vi.fn();
const stopMock = vi.fn();
const historyReplaceStateMock = vi.fn();

let chatMessages: Array<{
  id: string;
  parts: Array<{ text?: string; type: string }>;
  role: "assistant" | "user";
}> = [];

vi.mock("@ai-sdk/react", () => ({
  useChat: (options: { messages?: typeof chatMessages } = {}) => {
    chatMessages = options.messages ?? [];
    return {
      clearError: clearErrorMock,
      error: undefined,
      messages: chatMessages,
      sendMessage: sendMessageMock,
      status: "ready",
      stop: stopMock,
    };
  },
}));

vi.mock("@repo/ai/workspace-assistant", () => ({
  lightfastWorkspaceAssistantDataPartSchemas: {},
  lightfastWorkspaceAssistantMessageMetadataSchema: {},
}));

vi.mock("@repo/ui/components/ai-elements/conversation", () => ({
  Conversation: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ConversationContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  ConversationScrollButton: () => null,
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    isPending: false,
    mutateAsync: mutateAsyncMock,
  }),
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ slug: "lightfast" }),
  useRouter: () => ({
    invalidate: routerInvalidateMock,
    navigate: routerNavigateMock,
  }),
}));

vi.mock("@vendor/ai", () => ({
  DefaultChatTransport: class DefaultChatTransport {
    options: unknown;
    constructor(options: unknown) {
      this.options = options;
    }
  },
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        assistant: {
          createConversation: {
            mutationOptions: () => ({}),
          },
          listConversations: {
            queryFilter: listConversationsQueryFilterMock,
          },
        },
      },
    },
  }),
}));

vi.mock("./chat-composer", () => ({
  ChatComposer: ({
    error,
    onSubmit,
    onTextChange,
    status,
    text,
  }: {
    error?: Error;
    onSubmit: (message: { files: []; text: string }) => Promise<void>;
    onTextChange: (value: string) => void;
    status: string;
    text: string;
  }) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({ files: [], text });
      }}
    >
      <textarea
        aria-label="Message"
        onChange={(event) => onTextChange(event.currentTarget.value)}
        value={text}
      />
      <button aria-label="Send message" data-status={status} type="submit">
        Send
      </button>
      {error ? <p>{error.message}</p> : null}
    </form>
  ),
}));

vi.mock("./chat-message", () => ({
  ChatMessage: ({
    message,
  }: {
    message: { parts: Array<{ text?: string }> };
  }) => <div>{message.parts.map((part) => part.text).join("")}</div>,
}));

const { WorkspaceAssistantClient } = await import(
  "./workspace-assistant-client"
);

beforeEach(() => {
  chatMessages = [];
  clearErrorMock.mockClear();
  invalidateQueriesMock.mockClear();
  listConversationsQueryFilterMock.mockClear();
  mutateAsyncMock.mockReset();
  routerInvalidateMock.mockReset();
  routerNavigateMock.mockReset();
  sendMessageMock.mockReset();
  stopMock.mockClear();
  historyReplaceStateMock.mockReset();

  mutateAsyncMock.mockResolvedValue({
    publicId: "conv_ff83026e-ef0e-40db-ae59-544fbe4df209",
    title: "Summarize the current workspace",
  });
  sendMessageMock.mockResolvedValue(undefined);

  vi.stubGlobal("crypto", {
    randomUUID: () => "ff83026e-ef0e-40db-ae59-544fbe4df209",
  });
  vi.spyOn(History.prototype, "replaceState").mockImplementation(
    historyReplaceStateMock
  );
});

describe("WorkspaceAssistantClient", () => {
  it("writes the preallocated conversation URL before first conversation creation resolves", async () => {
    let resolveCreate:
      | ((conversation: { publicId: string; title: string }) => void)
      | undefined;
    mutateAsyncMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );

    render(
      <WorkspaceAssistantClient conversationId="conv_ff83026e-ef0e-40db-ae59-544fbe4df209" />
    );

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Summarize the current workspace" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        publicId: "conv_ff83026e-ef0e-40db-ae59-544fbe4df209",
        title: "Summarize the current workspace",
      });
    });
    expect(historyReplaceStateMock.mock.calls[0]?.[1]).toBe("");
    expect(historyReplaceStateMock.mock.calls[0]?.[2]).toBe(
      "/lightfast/chat/conv_ff83026e-ef0e-40db-ae59-544fbe4df209"
    );
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(routerNavigateMock).not.toHaveBeenCalled();
    expect(
      screen.getAllByText("Summarize the current workspace").length
    ).toBeGreaterThan(0);
    expect(
      screen
        .getByRole("button", { name: "Send message" })
        .getAttribute("data-status")
    ).toBe("submitted");

    resolveCreate?.({
      publicId: "conv_ff83026e-ef0e-40db-ae59-544fbe4df209",
      title: "Summarize the current workspace",
    });

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith(
        { text: "Summarize the current workspace" },
        {
          body: {
            conversationId: "conv_ff83026e-ef0e-40db-ae59-544fbe4df209",
            idempotencyKey: "idem_ff83026e-ef0e-40db-ae59-544fbe4df209",
          },
        }
      );
    });
    expect(routerNavigateMock).toHaveBeenCalledWith({
      params: {
        conversationId: "conv_ff83026e-ef0e-40db-ae59-544fbe4df209",
        slug: "lightfast",
      },
      replace: true,
      to: "/$slug/chat/$conversationId",
    });
    expect(routerInvalidateMock).not.toHaveBeenCalled();
  });
});
