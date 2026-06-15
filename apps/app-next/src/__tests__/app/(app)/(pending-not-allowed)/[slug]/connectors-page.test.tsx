import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const fetchQueryMock = vi.fn();
const listSectionsQueryOptions = {
  queryKey: ["org", "workspace", "connectors", "listSections"],
};
const listSectionsQueryOptionsMock = vi.fn(() => listSectionsQueryOptions);

vi.mock("~/trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery: fetchQueryMock }),
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-connectors">{children}</div>
  ),
  trpc: {
    org: {
      workspace: {
        connectors: {
          listSections: {
            queryOptions: listSectionsQueryOptionsMock,
          },
        },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-client",
  () => ({
    ConnectorsClient: ({
      callbackConnector,
      callbackError,
    }: {
      callbackConnector?: string;
      callbackError?: string;
    }) => (
      <div
        data-callback-connector={callbackConnector}
        data-callback-error={callbackError}
      >
        Connectors
      </div>
    ),
  })
);

const { default: ConnectorsPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/page"
);

describe("connectors page", () => {
  it("fetches connector sections before rendering hydrated client UI", async () => {
    fetchQueryMock.mockResolvedValue({
      teamConnectors: [],
      yourConnectors: [],
    });

    const element = await ConnectorsPage({
      searchParams: Promise.resolve({
        connector: "granola",
        error: "access_denied",
      }),
    });
    render(element);

    expect(listSectionsQueryOptionsMock).toHaveBeenCalled();
    expect(fetchQueryMock).toHaveBeenCalledWith(listSectionsQueryOptions);
    expect(screen.getByTestId("hydrated-connectors")).toHaveTextContent(
      "Connectors"
    );
    expect(screen.getByText("Connectors")).toHaveAttribute(
      "data-callback-connector",
      "granola"
    );
    expect(screen.getByText("Connectors")).toHaveAttribute(
      "data-callback-error",
      "access_denied"
    );
  });
});
