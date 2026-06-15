import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const infiniteQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "decisions", "list"],
}));
const prefetchMock = vi.fn();

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-decisions">{children}</div>
  ),
  prefetch: prefetchMock,
  trpc: {
    org: {
      workspace: {
        decisions: {
          list: {
            infiniteQueryOptions: infiniteQueryOptionsMock,
          },
        },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-client",
  () => ({
    DecisionsClient: () => <div>Decisions client</div>,
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/_components/decisions-loading",
  () => ({
    DecisionsLoading: () => <div>Loading decisions</div>,
  })
);

const { default: DecisionsPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/decisions/page"
);

beforeEach(() => {
  infiniteQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("decisions page", () => {
  it("prefetches the infinite decisions list before rendering the client island", () => {
    render(DecisionsPage());

    expect(infiniteQueryOptionsMock).toHaveBeenCalledWith(
      { limit: 50 },
      expect.objectContaining({ staleTime: 60_000 })
    );
    expect(prefetchMock).toHaveBeenCalled();
    expect(screen.getByTestId("hydrated-decisions")).toHaveTextContent(
      "Decisions client"
    );
  });
});
