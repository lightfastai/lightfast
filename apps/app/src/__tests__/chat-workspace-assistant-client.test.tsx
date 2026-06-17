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
const setQueryDataMock = vi.fn();
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

vi.mock("@repo/ui-v2/components/ai-elements/conversation", () => ({
  Conversation: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="conversation">
      {children}
    </div>
  ),
  ConversationContent: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="conversation-content">
      {children}
    </div>
  ),
  ConversationScrollButton: () => null,
}));

vi.mock("@tanstack/react-query", () => ({
  queryOptions: (options: unknown) => options,
  useMutation: () => ({
    isPending: false,
    mutateAsync: mutateAsyncMock,
  }),
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
    setQueryData: setQueryDataMock,
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
        onTextChange("");
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
  setQueryDataMock.mockClear();
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
  vi.restoreAllMocks();
});

describe("WorkspaceAssistantClient", () => {
  it("places the empty new chat landing in the upper-middle of the available workspace height", () => {
    render(
      <WorkspaceAssistantClient conversationId="conv_ff83026e-ef0e-40db-ae59-544fbe4df209" />
    );

    expect(
      screen.getByRole("heading", { name: "Ready when you are." })
    ).not.toBeNull();
    expect(
      screen
        .getByRole("heading", { name: "Ready when you are." })
        .closest("section")?.className
    ).toContain("min-h-[calc(100svh-3.5rem)]");
    expect(
      screen
        .getByRole("heading", { name: "Ready when you are." })
        .closest("section")?.className
    ).toContain("justify-start");
    expect(
      screen
        .getByRole("heading", { name: "Ready when you are." })
        .closest("section")?.className
    ).toContain("pt-[clamp(8rem,26svh,18rem)]");
    expect(
      screen
        .getByRole("heading", { name: "Ready when you are." })
        .closest("section")?.className
    ).toContain("px-4");
    expect(
      screen
        .getByRole("heading", { name: "Ready when you are." })
        .closest("section")?.className
    ).toContain("md:px-8");
    expect(
      screen
        .getByRole("heading", { name: "Ready when you are." })
        .closest("section")?.className
    ).not.toContain("max-w-3xl");
    expect(
      screen.getByRole("heading", { name: "Ready when you are." }).parentElement
        ?.className
    ).toContain("max-w-3xl");
    expect(
      screen.queryByText("Lightfast can make mistakes. Check important info.")
    ).toBeNull();
  });

  it("pins the existing chat composer below a bounded scrollable message region", () => {
    const { container } = render(
      <WorkspaceAssistantClient
        conversationId="conv_existing"
        initialConversation={conversationResult({
          messages: [
            {
              parts: [{ text: "Existing message", type: "text" }],
              publicId: "msg_existing",
              role: "user",
            },
          ],
        })}
      />
    );

    expect(container.querySelector("main")?.className).toContain(
      "h-[calc(100svh-3.5rem)]"
    );
    expect(container.querySelector("main")?.className).toContain(
      "overflow-hidden"
    );
    expect(screen.getByTestId("conversation").className).toContain("h-full");
    expect(
      screen.getByTestId("conversation").parentElement?.className
    ).toContain("overflow-hidden");
    expect(
      screen.getByRole("button", { name: "Send message" }).closest("form")
        ?.parentElement?.className
    ).toContain("shrink-0");
    expect(
      screen.getByText("Lightfast can make mistakes. Check important info.")
    ).not.toBeNull();
  });

  it("soft-replaces the browser URL before creation and syncs the router after send", async () => {
    let resolveCreate:
      | ((conversation: { publicId: string; title: string }) => void)
      | undefined;
    const replaceStateSpy = vi
      .spyOn(History.prototype, "replaceState")
      .mockImplementation(() => undefined);
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
    expect(replaceStateSpy).toHaveBeenCalledWith(
      window.history.state,
      "",
      "/lightfast/chat/conv_ff83026e-ef0e-40db-ae59-544fbe4df209"
    );
    expect(routerNavigateMock).not.toHaveBeenCalled();
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
    expect(setQueryDataMock).toHaveBeenCalledWith(
      [
        "workspace-assistant",
        "conversation",
        "conv_ff83026e-ef0e-40db-ae59-544fbe4df209",
      ],
      expect.objectContaining({
        conversation: expect.objectContaining({
          publicId: "conv_ff83026e-ef0e-40db-ae59-544fbe4df209",
        }),
        messages: [],
      })
    );
    await waitFor(() => {
      expect(routerNavigateMock).toHaveBeenCalledWith({
        params: {
          conversationId: "conv_ff83026e-ef0e-40db-ae59-544fbe4df209",
          slug: "lightfast",
        },
        replace: true,
        to: "/$slug/chat/$conversationId",
      });
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

  it("preserves a draft typed while the assistant response is streaming", async () => {
    let resolveSend: (() => void) | undefined;
    sendMessageMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSend = resolve;
        })
    );

    render(
      <WorkspaceAssistantClient
        conversationId="conv_existing"
        initialConversation={conversationResult()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Write" }));
    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Start this task" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith(
        { text: "Start this task" },
        expect.any(Object)
      );
    });

    fireEvent.change(screen.getByLabelText("Message"), {
      target: { value: "Draft the follow-up" },
    });
    expect(
      (screen.getByLabelText("Message") as HTMLTextAreaElement).value
    ).toBe("Draft the follow-up");

    resolveSend?.();

    await waitFor(() => {
      expect(
        screen
          .getByRole("button", { name: "Write" })
          .getAttribute("aria-pressed")
      ).toBe("false");
    });
    expect(
      (screen.getByLabelText("Message") as HTMLTextAreaElement).value
    ).toBe("Draft the follow-up");
  });
});

function conversationResult(
  overrides: Partial<WorkspaceAssistantConversationResult["conversation"]> & {
    messages?: Array<{
      parts: WorkspaceAssistantConversationResult["messages"][number]["parts"];
      publicId: string;
      role: WorkspaceAssistantConversationResult["messages"][number]["role"];
    }>;
  } = {}
): WorkspaceAssistantConversationResult {
  const { messages = [], ...conversationOverrides } = overrides;
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
      ...conversationOverrides,
    },
    messages: messages.map((message, index) => ({
      conversationId: 1,
      conversationPublicId: "conv_existing",
      clerkOrgId: "org_lightfast",
      createdAt: new Date("2026-06-15T00:00:00.000Z"),
      createdByUserId: "user_lightfast",
      errorCode: null,
      errorMessage: null,
      id: index + 1,
      idempotencyKey: null,
      metadata: {},
      parts: message.parts,
      publicId: message.publicId,
      role: message.role,
      sequence: index,
      status: "completed",
      updatedAt: new Date("2026-06-15T00:00:00.000Z"),
    })),
  };
}
