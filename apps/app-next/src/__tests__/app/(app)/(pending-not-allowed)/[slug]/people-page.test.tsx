import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const infiniteQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "people", "list"],
}));
const prefetchMock = vi.fn();

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-people">{children}</div>
  ),
  prefetch: prefetchMock,
  trpc: {
    org: {
      workspace: {
        people: {
          list: {
            infiniteQueryOptions: infiniteQueryOptionsMock,
          },
        },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-client",
  () => ({
    PeopleClient: () => <div>People client</div>,
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/_components/people-loading",
  () => ({
    PeopleLoading: () => <div>Loading people</div>,
  })
);

const { default: PeoplePage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/people/page"
);

beforeEach(() => {
  infiniteQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("people page", () => {
  it("prefetches the infinite people list before rendering the client island", () => {
    render(PeoplePage());

    expect(infiniteQueryOptionsMock).toHaveBeenCalledWith(
      { limit: 50 },
      expect.objectContaining({ staleTime: 60_000 })
    );
    expect(prefetchMock).toHaveBeenCalled();
    expect(screen.getByTestId("hydrated-people")).toHaveTextContent(
      "People client"
    );
  });
});
