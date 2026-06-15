import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchQueryMock = vi.fn();
const listQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "automations", "list"],
}));

vi.mock("~/trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery: fetchQueryMock }),
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-automations">{children}</div>
  ),
  trpc: {
    org: {
      workspace: {
        automations: {
          list: {
            queryOptions: listQueryOptionsMock,
          },
        },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/_components/automations-client",
  () => ({
    AutomationsClient: () => <div>Automation rows</div>,
  })
);

const { default: AutomationsPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/automations/page"
);

beforeEach(() => {
  fetchQueryMock.mockReset();
  listQueryOptionsMock.mockClear();
});

describe("automations page", () => {
  it("awaits the automation list before rendering hydrated client UI", async () => {
    fetchQueryMock.mockResolvedValue([]);

    const element = await AutomationsPage();
    render(element);

    expect(listQueryOptionsMock).toHaveBeenCalledOnce();
    expect(fetchQueryMock).toHaveBeenCalledWith({
      queryKey: ["org", "workspace", "automations", "list"],
    });
    expect(screen.getByTestId("hydrated-automations")).toHaveTextContent(
      "Automation rows"
    );
  });
});
