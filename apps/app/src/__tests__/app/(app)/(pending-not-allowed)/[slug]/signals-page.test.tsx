import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "signals", "list", { limit: 50 }],
}));
const prefetchMock = vi.fn();

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-signals">{children}</div>
  ),
  prefetch: prefetchMock,
  trpc: {
    org: {
      workspace: {
        signals: {
          list: {
            queryOptions: listQueryOptionsMock,
          },
        },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-client",
  () => ({
    SignalsClient: () => <div>Signals client</div>,
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signals-loading",
  () => ({
    SignalsLoading: () => <div>Loading signals</div>,
  })
);

const { default: SignalsPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/page"
);

beforeEach(() => {
  listQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("signals page", () => {
  it("prefetches the signals list before rendering the client island", async () => {
    const element = await SignalsPage();
    render(element);

    expect(listQueryOptionsMock).toHaveBeenCalledWith({ limit: 50 });
    expect(prefetchMock).toHaveBeenCalledWith({
      queryKey: ["org", "workspace", "signals", "list", { limit: 50 }],
    });
    expect(screen.getByTestId("hydrated-signals")).toHaveTextContent(
      "Signals client"
    );
  });
});
