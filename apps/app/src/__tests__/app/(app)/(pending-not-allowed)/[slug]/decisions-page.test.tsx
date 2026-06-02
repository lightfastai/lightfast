import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchQueryMock = vi.fn();
const listQueryOptionsMock = vi.fn((input: unknown) => ({
  input,
  queryKey: ["org", "workspace", "decisions", "list", input],
}));

vi.mock("~/trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery: fetchQueryMock }),
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-decisions">{children}</div>
  ),
  trpc: {
    org: {
      workspace: {
        decisions: {
          list: {
            queryOptions: listQueryOptionsMock,
          },
        },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-client",
  () => ({
    DecisionsClient: () => <div>Decision rows</div>,
  })
);

const { default: DecisionsPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/page"
);

beforeEach(() => {
  fetchQueryMock.mockReset();
  listQueryOptionsMock.mockClear();
});

describe("decisions page", () => {
  it("awaits the decisions list before rendering hydrated client UI", async () => {
    fetchQueryMock.mockResolvedValue([]);

    const element = await DecisionsPage();
    render(element);

    expect(listQueryOptionsMock).toHaveBeenCalledWith({ limit: 50 });
    expect(fetchQueryMock).toHaveBeenCalledWith({
      input: { limit: 50 },
      queryKey: ["org", "workspace", "decisions", "list", { limit: 50 }],
    });
    expect(screen.getByTestId("hydrated-decisions")).toHaveTextContent(
      "Decision rows"
    );
  });
});
