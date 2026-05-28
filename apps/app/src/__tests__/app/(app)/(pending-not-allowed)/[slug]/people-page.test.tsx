import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "people", "list", { limit: 50 }],
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
            queryOptions: listQueryOptionsMock,
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
  listQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("people page", () => {
  it("prefetches the people list before rendering the client island", async () => {
    const element = await PeoplePage();
    render(element);

    expect(listQueryOptionsMock).toHaveBeenCalledWith({ limit: 50 });
    expect(prefetchMock).toHaveBeenCalledWith({
      queryKey: ["org", "workspace", "people", "list", { limit: 50 }],
    });
    expect(screen.getByTestId("hydrated-people")).toHaveTextContent(
      "People client"
    );
  });
});
