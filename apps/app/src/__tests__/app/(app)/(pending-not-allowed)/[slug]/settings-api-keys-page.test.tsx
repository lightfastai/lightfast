import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchQueryMock = vi.fn();
const listQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "orgApiKeys", "list"],
}));
const prefetchMock = vi.fn();

vi.mock("@repo/app-trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery: fetchQueryMock }),
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-api-keys">{children}</div>
  ),
  prefetch: prefetchMock,
  trpc: {
    org: {
      settings: {
        orgApiKeys: {
          list: {
            queryOptions: listQueryOptionsMock,
          },
        },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/api-keys/_components/org-api-key-create",
  () => ({
    OrgApiKeyCreate: () => <button type="button">Create Key</button>,
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/api-keys/_components/org-api-key-list",
  () => ({
    OrgApiKeyList: () => <div>API key rows</div>,
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/api-keys/_components/org-api-key-list-loading",
  () => ({
    OrgApiKeyListLoading: () => <div>Loading API keys</div>,
  })
);

const { default: OrgApiKeysPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/api-keys/page"
);

beforeEach(() => {
  fetchQueryMock.mockReset();
  listQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("api keys settings page", () => {
  it("awaits the org API keys list query before rendering hydrated client islands", async () => {
    fetchQueryMock.mockResolvedValue([]);

    const element = await OrgApiKeysPage();
    render(element);

    expect(listQueryOptionsMock).toHaveBeenCalledOnce();
    expect(fetchQueryMock).toHaveBeenCalledWith({
      queryKey: ["org", "settings", "orgApiKeys", "list"],
    });
    expect(prefetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("hydrated-api-keys")).toContainElement(
      screen.getByRole("button", { name: "Create Key" })
    );
    expect(screen.getByTestId("hydrated-api-keys")).toHaveTextContent(
      "API key rows"
    );
  });
});
