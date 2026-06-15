import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const workingSetQueryOptionsMock = vi.fn((input: unknown, opts: unknown) => ({
  input,
  opts,
  queryKey: ["org", "workspace", "signals", "workingSet"],
}));
const listQueryOptionsMock = vi.fn((input: unknown, opts: unknown) => ({
  input,
  opts,
  queryKey: ["org", "workspace", "signals", "list", input],
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
          list: { queryOptions: listQueryOptionsMock },
          workingSet: { queryOptions: workingSetQueryOptionsMock },
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
  workingSetQueryOptionsMock.mockClear();
  listQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("signals page", () => {
  it("prefetches the working set and the processing list", async () => {
    const element = await SignalsPage();
    render(element);

    expect(workingSetQueryOptionsMock).toHaveBeenCalledTimes(1);
    expect(listQueryOptionsMock).toHaveBeenCalledWith(
      { limit: 100, statuses: ["queued", "processing"] },
      expect.objectContaining({ staleTime: 5000 })
    );
    expect(prefetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("hydrated-signals")).toHaveTextContent(
      "Signals client"
    );
  });
});
