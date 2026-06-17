// @vitest-environment happy-dom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceAssistantConversationResult } from "~/chat/workspace-assistant-queries";

const clearErrorMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const mutateAsyncMock = vi.fn();
const routerInvalidateMock = vi.fn();
const routerNavigateMock = vi.fn();
const sendMessageMock = vi.fn();
const stopMock = vi.fn();

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

vi.mock("@api/app/tanstack/assistant", () => ({
  createConversation: vi.fn(),
  getConversation: vi.fn(),
  listConversations: vi.fn(),
}));

vi.mock("@repo/ui/components/ai-elements/conversation", () => ({
  Conversation: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
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

vi.mock("~/chat/chat-composer", () => ({
  ChatComposer: ({
    error,
    onSubmit,
    onTextChange,
    onWriteModeChange,
    status,
    text,
    writeModeEnabled,
  }: {
    error?: Error;
    onSubmit: (message: { files: []; text: string }) => Promise<void>;
    onTextChange: (value: string) => void;
    onWriteModeChange?: (enabled: boolean) => void;
    status: string;
    text: string;
    writeModeEnabled?: boolean;
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
      <button
        aria-pressed={writeModeEnabled ? "true" : "false"}
        onClick={() => onWriteModeChange?.(!writeModeEnabled)}
        type="button"
      >
        Write
      </button>
      <button aria-label="Send message" data-status={status} type="submit">
        Send
      </button>
      {error ? <p>{error.message}</p> : null}
    </form>
  ),
}));

vi.mock("~/chat/chat-message", () => ({
  ChatMessage: ({
    message,
  }: {
    message: { parts: Array<{ text?: string }> };
  }) => <div>{message.parts.map((part) => part.text).join("")}</div>,
}));

const { WorkspaceAssistantClient } = await import(
  "~/chat/workspace-assistant-client"
);

beforeEach(() => {
  chatMessages = [];
  clearErrorMock.mockClear();
  invalidateQueriesMock.mockClear();
  mutateAsyncMock.mockReset();
  routerInvalidateMock.mockReset();
  routerNavigateMock.mockReset();
  sendMessageMock.mockReset();
  stopMock.mockClear();

  mutateAsyncMock.mockResolvedValue({
    publicId: "conv_ff83026e-ef0e-40db-ae59-544fbe4df209",
    title: "Summarize the current workspace",
  });
  sendMessageMock.mockResolvedValue(undefined);

  vi.stubGlobal("crypto", {
    randomUUID: () => "ff83026e-ef0e-40db-ae59-544fbe4df209",
  });
});

afterEach(() => {
  cleanup();
});

describe("WorkspaceAssistantClient", () => {
  it("navigates to the preallocated conversation URL before first conversation creation resolves", async () => {
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
    expect(routerNavigateMock).toHaveBeenNthCalledWith(1, {
      params: {
        conversationId: "conv_ff83026e-ef0e-40db-ae59-544fbe4df209",
        slug: "lightfast",
      },
      replace: true,
      to: "/$slug/chat/$conversationId",
    });
    expect(sendMessageMock).not.toHaveBeenCalled();
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
    expect(routerNavigateMock).toHaveBeenNthCalledWith(2, {
      params: {
        conversationId: "conv_ff83026e-ef0e-40db-ae59-544fbe4df209",
        slug: "lightfast",
      },
      replace: true,
      to: "/$slug/chat/$conversationId",
    });
    expect(routerInvalidateMock).not.toHaveBeenCalled();
  });

  it("clamps the first prompt when using it as the conversation title", async () => {
    const longPrompt = "Summarize ".repeat(24).trim();

    render(
      <WorkspaceAssistantClient conversationId="conv_ff83026e-ef0e-40db-ae59-544fbe4df209" />
    );

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: longPrompt },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        publicId: "conv_ff83026e-ef0e-40db-ae59-544fbe4df209",
        title: longPrompt.slice(0, 160),
      });
    });
  });

  it("sends one existing conversation turn with provider routine write mode enabled", async () => {
    render(
      <WorkspaceAssistantClient
        conversationId="conv_existing"
        initialConversation={conversationResult()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Write" }));
    expect(
      screen.getByRole("button", { name: "Write" }).getAttribute("aria-pressed")
    ).toBe("true");
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Update the Linear ticket" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith(
        { text: "Update the Linear ticket" },
        {
          body: {
            conversationId: "conv_existing",
            idempotencyKey: "idem_ff83026e-ef0e-40db-ae59-544fbe4df209",
            providerRoutineWriteMode: true,
          },
        }
      );
    });
    await waitFor(() => {
      expect(
        screen
          .getByRole("button", { name: "Write" })
          .getAttribute("aria-pressed")
      ).toBe("false");
    });
  });
});

function conversationResult(
  overrides: Partial<WorkspaceAssistantConversationResult["conversation"]> = {}
): WorkspaceAssistantConversationResult {
  return {
    conversation: {
      activeStreamId: null,
      clerkOrgId: "org_lightfast",
      createdAt: new Date("2026-06-15T00:00:00.000Z"),
      createdByUserId: "user_lightfast",
      id: 1,
      lastMessageAt: null,
      lastMessageId: null,
      metadata: {},
      publicId: "conv_existing",
      status: "active",
      title: "Existing chat",
      updatedAt: new Date("2026-06-15T00:00:00.000Z"),
      ...overrides,
    },
    messages: [],
  };
}
