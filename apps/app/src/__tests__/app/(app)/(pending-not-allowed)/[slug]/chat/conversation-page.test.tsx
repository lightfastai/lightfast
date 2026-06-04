import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchQueryMock = vi.fn();
const getConversationQueryOptionsMock = vi.fn((input: { id: string }) => ({
  input,
  queryKey: ["org", "workspace", "assistant", "getConversation", input.id],
}));
let receivedProps:
  | {
      conversationId?: string;
      initialConversation?: unknown;
    }
  | undefined;

vi.mock("~/trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery: fetchQueryMock }),
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-chat">{children}</div>
  ),
  trpc: {
    org: {
      workspace: {
        assistant: {
          getConversation: {
            queryOptions: getConversationQueryOptionsMock,
          },
        },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client",
  () => ({
    WorkspaceAssistantClient: (props: {
      conversationId: string;
      initialConversation?: unknown;
    }) => {
      receivedProps = props;
      return <div>Workspace assistant client</div>;
    },
  })
);

const { default: ConversationPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/chat/[conversationId]/page"
);

beforeEach(() => {
  fetchQueryMock.mockReset();
  getConversationQueryOptionsMock.mockClear();
  receivedProps = undefined;
});

describe("workspace conversation page", () => {
  it("SSR-fetches persisted conversation data before hydrating the chat client", async () => {
    const initialConversation = {
      conversation: { publicId: "conv_existing" },
      messages: [],
    };
    fetchQueryMock.mockResolvedValue(initialConversation);

    render(
      await ConversationPage({
        params: Promise.resolve({
          conversationId: "conv_existing",
          slug: "acme",
        }),
      })
    );

    expect(getConversationQueryOptionsMock).toHaveBeenCalledWith({
      id: "conv_existing",
    });
    expect(fetchQueryMock).toHaveBeenCalledWith({
      input: { id: "conv_existing" },
      queryKey: [
        "org",
        "workspace",
        "assistant",
        "getConversation",
        "conv_existing",
      ],
    });
    expect(screen.getByTestId("hydrated-chat")).toHaveTextContent(
      "Workspace assistant client"
    );
    expect(receivedProps).toEqual({
      conversationId: "conv_existing",
      initialConversation,
    });
  });

  it("renders a draft conversation on the conversation route when the preallocated id is not persisted yet", async () => {
    fetchQueryMock.mockRejectedValue(
      Object.assign(new Error("Workspace assistant conversation not found"), {
        code: "NOT_FOUND",
      })
    );

    render(
      await ConversationPage({
        params: Promise.resolve({
          conversationId: "conv_draft",
          slug: "acme",
        }),
      })
    );

    expect(receivedProps).toEqual({
      conversationId: "conv_draft",
      initialConversation: undefined,
    });
  });

  it("lets non-404 load errors reach the route error boundary", async () => {
    const error = new Error("database unavailable");
    fetchQueryMock.mockRejectedValue(error);

    await expect(
      ConversationPage({
        params: Promise.resolve({
          conversationId: "conv_existing",
          slug: "acme",
        }),
      })
    ).rejects.toBe(error);
  });
});
