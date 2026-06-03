import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "skills", "list"],
}));
const prefetchMock = vi.fn();

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-chat">{children}</div>
  ),
  prefetch: prefetchMock,
  trpc: {
    org: {
      workspace: {
        skills: {
          list: {
            queryOptions: listQueryOptionsMock,
          },
        },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/workspace-assistant-client",
  () => ({
    WorkspaceAssistantClient: () => <div>Workspace assistant client</div>,
  })
);

const { default: ChatPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/chat/page"
);

beforeEach(() => {
  listQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("workspace chat page", () => {
  it("renders the empty workspace assistant chat at the canonical chat URL", () => {
    render(ChatPage());

    expect(listQueryOptionsMock).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ staleTime: 0 })
    );
    expect(prefetchMock).toHaveBeenCalled();
    expect(screen.getByTestId("hydrated-chat")).toHaveTextContent(
      "Workspace assistant client"
    );
  });
});
