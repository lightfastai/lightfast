import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "skills", "list"],
}));
const createConversationMutationOptionsMock = vi.fn(() => ({}));
const listConversationsQueryFilterMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "assistant", "listConversations"],
}));
const clearErrorMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const mutateAsyncMock = vi.fn();
const pushMock = vi.fn();
const refreshMock = vi.fn();
const replaceMock = vi.fn();
const sendMessageMock = vi.fn();
const setMessagesMock = vi.fn();
const stopMock = vi.fn();
const writeTextMock = vi.fn();
const historyReplaceStateMock = vi.fn();
let useChatOptions: Record<string, unknown> | undefined;
let transportOptions: Record<string, unknown> | undefined;
// Every id handed to useChat, in render order. Conversation identity must be a
// stable input (never an undefined -> real flip mid-send, which would orphan the
// in-flight Chat instance — see @ai-sdk/react recreate-on-id-change).
const recordedChatIds: (string | undefined)[] = [];

let chatStatus: "error" | "ready" | "streaming" | "submitted" = "ready";
let workspaceAssistantMessages: WorkspaceAssistantMessageFixture[] = [];
let promptInputFiles: PromptInputFileFixture[] = [];
let listData = createListData({
  skills: [
    createSkill({
      description: "Create new skills, modify and improve existing skills.",
      name: "Create skill",
      slug: "create-skill",
    }),
    createSkill({
      description: "Build and maintain a knowledge base from sources.",
      name: "Add knowledge",
      slug: "add-knowledge",
    }),
  ],
});

vi.mock("@vendor/ai", () => ({
  DefaultChatTransport: class DefaultChatTransport {
    options: unknown;
    constructor(options: unknown) {
      this.options = options;
      transportOptions = options as Record<string, unknown>;
    }
  },
  tool: vi.fn((definition: unknown) => definition),
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({
    count,
    getItemKey,
  }: {
    count: number;
    getItemKey: (index: number) => string | number;
  }) => ({
    getTotalSize: () => count * 120,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: getItemKey(index),
        start: index * 120,
        size: 120,
      })),
    measureElement: () => undefined,
  }),
}));

vi.mock("@ai-sdk/react", () => ({
  useChat: (
    options: { id?: string; messages?: WorkspaceAssistantMessageFixture[] } = {}
  ) => {
    const { messages = [] } = options;
    useChatOptions = options as Record<string, unknown>;
    recordedChatIds.push(options.id);
    workspaceAssistantMessages = messages;
    return {
      clearError: clearErrorMock,
      error: undefined,
      messages: workspaceAssistantMessages,
      sendMessage: sendMessageMock,
      setMessages: setMessagesMock,
      status: chatStatus,
      stop: stopMock,
    };
  },
}));

vi.mock("@repo/ui/components/ai-elements/message", () => ({
  Message: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  MessageContent: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="message-content">
      {children}
    </div>
  ),
  MessageResponse: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  MessageActions: ({
    children,
    className,
  }: {
    children?: ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="message-actions">
      {children}
    </div>
  ),
  MessageAction: ({
    children,
    label,
    onClick,
  }: {
    children?: ReactNode;
    label?: string;
    onClick?: () => void;
    tooltip?: string;
  }) => (
    <button aria-label={label} onClick={onClick} type="button">
      {children}
    </button>
  ),
}));

vi.mock("@repo/ui/components/ai-elements/reasoning", () => ({
  Reasoning: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ReasoningContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  ReasoningTrigger: () => <button type="button">Reasoning</button>,
}));

vi.mock("@repo/ui/components/ai-elements/tool", () => ({
  Tool: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ToolContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  ToolHeader: () => <button type="button">Tool</button>,
  ToolInput: () => <div>Tool input</div>,
  ToolOutput: () => <div>Tool output</div>,
}));

vi.mock("@repo/ui/components/ai-elements/prompt-input", () => ({
  PromptInput: ({
    children,
    className,
    onSubmit,
  }: {
    children?: ReactNode;
    className?: string;
    onSubmit: (
      message: { files: PromptInputFileFixture[]; text: string },
      event: React.FormEvent<HTMLFormElement>
    ) => Promise<void>;
  }) => (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        void onSubmit(
          {
            files: promptInputFiles,
            text: String(formData.get("message") ?? ""),
          },
          event
        );
      }}
    >
      {children}
    </form>
  ),
  PromptInputBody: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  PromptInputFooter: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  PromptInputSubmit: ({
    "aria-label": ariaLabel,
    disabled,
  }: {
    "aria-label"?: string;
    disabled?: boolean;
  }) => (
    <button aria-label={ariaLabel} disabled={disabled} type="submit">
      Send
    </button>
  ),
  PromptInputTextarea: (
    props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
  ) => <textarea name="message" {...props} />,
  PromptInputTools: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        assistant: {
          createConversation: {
            mutationOptions: createConversationMutationOptionsMock,
          },
          listConversations: {
            queryFilter: listConversationsQueryFilterMock,
          },
        },
        skills: {
          list: {
            queryOptions: listQueryOptionsMock,
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    isPending: false,
    mutateAsync: mutateAsyncMock,
  }),
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
  useSuspenseQuery: () => ({ data: listData }),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: "acme" }),
  useRouter: () => ({
    push: pushMock,
    refresh: refreshMock,
    replace: replaceMock,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { WorkspaceAssistantClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client"
);

beforeEach(() => {
  chatStatus = "ready";
  workspaceAssistantMessages = [];
  promptInputFiles = [];
  clearErrorMock.mockClear();
  createConversationMutationOptionsMock.mockClear();
  listConversationsQueryFilterMock.mockClear();
  invalidateQueriesMock.mockClear();
  mutateAsyncMock.mockReset();
  mutateAsyncMock.mockResolvedValue({
    publicId: "conv_new",
    title: "Summarize my active opportunities",
  });
  pushMock.mockClear();
  refreshMock.mockClear();
  replaceMock.mockClear();
  sendMessageMock.mockReset();
  sendMessageMock.mockResolvedValue(undefined);
  setMessagesMock.mockClear();
  stopMock.mockClear();
  writeTextMock.mockReset();
  historyReplaceStateMock.mockReset();
  useChatOptions = undefined;
  transportOptions = undefined;
  recordedChatIds.length = 0;
  vi.stubGlobal("crypto", {
    randomUUID: () => "123e4567-e89b-12d3-a456-426614174000",
  });
  vi.spyOn(window.history, "replaceState").mockImplementation(
    historyReplaceStateMock
  );
  writeTextMock.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: writeTextMock,
    },
  });
  listQueryOptionsMock.mockClear();
  listData = createListData({
    skills: [
      createSkill({
        description: "Create new skills, modify and improve existing skills.",
        name: "Create skill",
        slug: "create-skill",
      }),
      createSkill({
        description: "Build and maintain a knowledge base from sources.",
        name: "Add knowledge",
        slug: "add-knowledge",
      }),
    ],
  });
});

describe("WorkspaceAssistantClient", () => {
  it("renders the empty state ready for the first prompt", () => {
    const { container } = render(
      <WorkspaceAssistantClient conversationId="conv_new" />
    );

    expect(
      screen.getByRole("heading", { name: "Ready when you are." })
    ).toBeVisible();
    expect(container.querySelector("main")).toHaveClass("bg-background");
    expect(screen.getByPlaceholderText("Ask Lightfield")).toBeVisible();
  });

  it("disables sending until text is entered", () => {
    render(<WorkspaceAssistantClient conversationId="conv_new" />);

    const submit = screen.getByRole("button", { name: "Send message" });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Ask Lightfield"), {
      target: { value: "Summarize my active opportunities" },
    });

    expect(submit).toBeEnabled();
  });

  it("enables sending from textarea input events", () => {
    render(<WorkspaceAssistantClient conversationId="conv_new" />);

    const submit = screen.getByRole("button", { name: "Send message" });
    expect(submit).toBeDisabled();

    fireEvent.input(screen.getByPlaceholderText("Ask Lightfield"), {
      target: { value: "Summarize my active opportunities" },
    });

    expect(submit).toBeEnabled();
  });

  it("creates an addressable conversation before sending the first prompt", async () => {
    render(<WorkspaceAssistantClient conversationId="conv_new" />);

    fireEvent.change(screen.getByPlaceholderText("Ask Lightfield"), {
      target: { value: "Summarize my active opportunities" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        publicId: "conv_new",
        title: "Summarize my active opportunities",
      });
    });
    expect(historyReplaceStateMock).toHaveBeenCalledWith(
      {},
      "",
      "/acme/chat/conv_new"
    );
    expect(replaceMock).not.toHaveBeenCalled();
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["org", "workspace", "assistant", "listConversations"],
    });
    expect(sendMessageMock).toHaveBeenCalledWith(
      { text: "Summarize my active opportunities" },
      {
        body: {
          idempotencyKey: expect.stringMatching(/^idem_/),
          conversationId: "conv_new",
        },
      }
    );
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("keeps the preallocated route stable while waiting for the first conversation create", async () => {
    let resolveCreate:
      | ((conversation: { publicId: string; title: string }) => void)
      | undefined;
    mutateAsyncMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );
    render(<WorkspaceAssistantClient conversationId="conv_new" />);

    fireEvent.change(screen.getByPlaceholderText("Ask Lightfield"), {
      target: { value: "Summarize my active opportunities" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(historyReplaceStateMock).toHaveBeenCalledWith(
      {},
      "",
      "/acme/chat/conv_new"
    );
    expect(replaceMock).not.toHaveBeenCalled();
    expect(mutateAsyncMock).toHaveBeenCalledWith({
      publicId: "conv_new",
      title: "Summarize my active opportunities",
    });
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();

    resolveCreate?.({
      publicId: "conv_new",
      title: "Summarize my active opportunities",
    });

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith(
        { text: "Summarize my active opportunities" },
        {
          body: {
            idempotencyKey: expect.stringMatching(/^idem_/),
            conversationId: "conv_new",
          },
        }
      );
    });
    expect(refreshMock).toHaveBeenCalledOnce();
  });

  it("stays on the draft conversation route and shows an error when creation fails", async () => {
    mutateAsyncMock.mockRejectedValue(new Error("Unable to create draft"));

    render(<WorkspaceAssistantClient conversationId="conv_new" />);

    fireEvent.change(screen.getByPlaceholderText("Ask Lightfield"), {
      target: { value: "Summarize my active opportunities" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(replaceMock).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("Unable to create draft")).toBeVisible();
    });
    expect(historyReplaceStateMock).toHaveBeenNthCalledWith(
      1,
      {},
      "",
      "/acme/chat/conv_new"
    );
    expect(historyReplaceStateMock).toHaveBeenNthCalledWith(
      2,
      {},
      "",
      "/acme/chat"
    );
    expect(refreshMock).not.toHaveBeenCalled();
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it("does not let hidden attachment state block a text prompt", async () => {
    promptInputFiles = [
      {
        filename: "notes.txt",
        mediaType: "text/plain",
        type: "file",
        url: "data:text/plain;base64,bm90ZXM=",
      },
    ];
    render(<WorkspaceAssistantClient conversationId="conv_new" />);

    fireEvent.change(screen.getByPlaceholderText("Ask Lightfield"), {
      target: { value: "Summarize my active opportunities" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith(
        { text: "Summarize my active opportunities" },
        {
          body: {
            idempotencyKey: expect.stringMatching(/^idem_/),
            conversationId: "conv_new",
          },
        }
      );
    });
  });

  it("labels the submit control as stop while generation is running", () => {
    chatStatus = "streaming";

    render(<WorkspaceAssistantClient conversationId="conv_new" />);

    expect(
      screen.getByRole("button", { name: "Stop generating" })
    ).toBeEnabled();
  });

  it("renders persisted chat messages and sends follow-ups to the existing conversation", async () => {
    render(
      <WorkspaceAssistantClient
        conversationId="conv_existing"
        initialConversation={{
          messages: [
            makeWorkspaceAssistantMessage({
              parts: [
                { text: "Summarize my active opportunities", type: "text" },
              ],
              publicId: "msg_user",
              role: "user",
            }),
            makeWorkspaceAssistantMessage({
              parts: [{ text: "No active opportunities yet.", type: "text" }],
              publicId: "msg_assistant",
              role: "assistant",
            }),
          ],
          conversation: makeWorkspaceAssistantConversation(),
        }}
      />
    );

    const messageContents = screen.getAllByTestId("message-content");
    expect(messageContents[0]).toHaveClass("group-[.is-user]:rounded-3xl");
    expect(messageContents[1]).toHaveClass("bg-transparent");
    expect(screen.getByText("No active opportunities yet.")).toBeVisible();

    fireEvent.change(screen.getByPlaceholderText("Ask Lightfield"), {
      target: { value: "What skills are available?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(sendMessageMock).toHaveBeenCalledWith(
        { text: "What skills are available?" },
        {
          body: {
            idempotencyKey: expect.stringMatching(/^idem_/),
            conversationId: "conv_existing",
          },
        }
      );
    });
    expect(mutateAsyncMock).not.toHaveBeenCalled();
    expect(useChatOptions).toMatchObject({
      id: "conv_existing",
      resume: true,
    });
    expect(transportOptions).toMatchObject({
      api: "/api/chat",
      prepareReconnectToStreamRequest: expect.any(Function),
      prepareSendMessagesRequest: expect.any(Function),
    });
  });

  it("uses tokenized composer styling", () => {
    const { container } = render(
      <WorkspaceAssistantClient conversationId="conv_new" />
    );

    expect(container.querySelector("form")).toHaveClass(
      "rounded-[1.75rem]",
      "border",
      "border-border/50",
      "bg-secondary",
      "shadow-lg",
      "[&_[data-slot=input-group]]:border-0",
      "[&_[data-slot=input-group]]:bg-transparent"
    );
  });

  it("copies a message's text and shows copied feedback", async () => {
    render(
      <WorkspaceAssistantClient
        conversationId="conv_existing"
        initialConversation={{
          messages: [
            makeWorkspaceAssistantMessage({
              parts: [
                { text: "Summarize my active opportunities", type: "text" },
              ],
              publicId: "msg_user",
              role: "user",
            }),
          ],
          conversation: makeWorkspaceAssistantConversation(),
        }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(
        "Summarize my active opportunities"
      );
    });
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });

  it("renders non-text message parts with visible fallbacks", () => {
    render(
      <WorkspaceAssistantClient
        conversationId="conv_existing"
        initialConversation={{
          messages: [
            makeWorkspaceAssistantMessage({
              parts: [
                {
                  filename: "brief.pdf",
                  mediaType: "application/pdf",
                  type: "file",
                  url: "https://example.com/brief.pdf",
                },
                {
                  title: "CRM export",
                  type: "source-document",
                },
                {
                  data: { count: 0 },
                  type: "data-opportunities",
                },
              ],
              publicId: "msg_assistant",
              role: "assistant",
            }),
          ],
          conversation: makeWorkspaceAssistantConversation(),
        }}
      />
    );

    expect(screen.getByRole("link", { name: "brief.pdf" })).toHaveAttribute(
      "href",
      "https://example.com/brief.pdf"
    );
    expect(screen.getByText("Source: CRM export")).toBeVisible();
    expect(screen.getByText("opportunities data received")).toBeVisible();
  });

  it("keeps a stable chat id across the first message in a new chat", async () => {
    render(<WorkspaceAssistantClient conversationId="conv_new" />);

    fireEvent.change(screen.getByPlaceholderText("Ask Lightfield"), {
      target: { value: "Summarize my active opportunities" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(sendMessageMock).toHaveBeenCalledTimes(1));

    // The id must never flip (e.g. undefined -> real) while the first message is
    // in flight, or the stream lands on an orphaned Chat instance and the view
    // never leaves the empty state.
    expect(recordedChatIds.every((id) => id === "conv_new")).toBe(true);
  });

  it("drives the chat id from the conversationId prop, not frozen state", () => {
    const { rerender } = render(
      <WorkspaceAssistantClient
        conversationId="conv_a"
        initialConversation={{
          messages: [],
          conversation: {
            ...makeWorkspaceAssistantConversation(),
            publicId: "conv_a",
          },
        }}
      />
    );

    // Simulate navigating to a different thread without a remount (the failure
    // mode behind sidebar thread clicks): the id must follow the prop.
    rerender(
      <WorkspaceAssistantClient
        conversationId="conv_b"
        initialConversation={{
          messages: [],
          conversation: {
            ...makeWorkspaceAssistantConversation(),
            publicId: "conv_b",
          },
        }}
      />
    );

    expect(recordedChatIds.at(-1)).toBe("conv_b");
  });
});

interface WorkspaceAssistantMessageFixture {
  id: string;
  metadata?: Record<string, unknown>;
  parts: Array<Record<string, unknown> & { type: string }>;
  role: "assistant" | "user";
}

interface PromptInputFileFixture {
  filename: string;
  mediaType: string;
  type: "file";
  url: string;
}

function makeWorkspaceAssistantConversation() {
  return {
    clerkOrgId: "org_test",
    createdAt: new Date("2026-06-02T00:00:00.000Z"),
    createdByUserId: "user_test",
    id: 1,
    lastMessageAt: null,
    lastMessageId: null,
    metadata: {},
    publicId: "conv_existing",
    activeStreamId: null,
    status: "active" as const,
    title: "Summarize my active opportunities",
    updatedAt: new Date("2026-06-02T00:00:00.000Z"),
  };
}

function makeWorkspaceAssistantMessage(
  overrides: Record<string, unknown> = {}
) {
  return {
    conversationId: 1,
    conversationPublicId: "conv_existing",
    clerkOrgId: "org_test",
    createdAt: new Date("2026-06-02T00:00:00.000Z"),
    createdByUserId: "user_test",
    errorCode: null,
    errorMessage: null,
    id: 1,
    metadata: {},
    parts: [],
    publicId: "msg_123",
    idempotencyKey: null,
    role: "user" as const,
    sequence: 0,
    status: "completed" as const,
    updatedAt: new Date("2026-06-02T00:00:00.000Z"),
    ...overrides,
  };
}

function createListData(input: { skills: ReturnType<typeof createSkill>[] }) {
  return {
    freshness: {
      checkedAt: new Date("2026-06-01T00:00:00.000Z"),
      errorCode: null,
      errorMessage: null,
      githubCommitSha: "a".repeat(40),
      indexedAt: new Date("2026-06-01T00:00:00.000Z"),
      indexedCommitSha: "a".repeat(40),
      status: "fresh" as const,
    },
    indexDiagnostics: [],
    repositoryUrl: "https://github.com/acme/.lightfast",
    skills: input.skills,
  };
}

function createSkill(overrides: Partial<ReturnType<typeof baseSkill>> = {}) {
  return {
    ...baseSkill(),
    ...overrides,
  };
}

function baseSkill() {
  const now = new Date("2026-06-01T00:00:00.000Z");
  return {
    allowedTools: null,
    bodyMarkdown: "Body",
    compatibility: null,
    contentSha: "content-sha",
    contentSize: 100,
    createdAt: now,
    description: "Review code changes",
    diagnostics: [],
    id: 1,
    indexedCommitSha: "a".repeat(40),
    license: null,
    metadata: {},
    name: "Code review",
    nonStandardResourceCount: 0,
    path: "skills/code-review/SKILL.md",
    resources: { assets: [], references: [], scripts: [], truncated: false },
    resourcesTruncated: 0 as const,
    skillIndexStateId: 1,
    slug: "code-review",
    sourceMarkdown: "---\nname: code-review\n---\nBody",
    updatedAt: now,
    validationStatus: "valid" as const,
  };
}
