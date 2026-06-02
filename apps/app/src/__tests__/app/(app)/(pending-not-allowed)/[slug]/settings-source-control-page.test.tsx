import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sourceControlGetQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "sourceControl", "get"],
}));
const sourceControlListRepositoriesQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "sourceControl", "listRepositories"],
}));
const prefetchMock = vi.fn();

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-source-control">{children}</div>
  ),
  prefetch: prefetchMock,
  trpc: {
    org: {
      settings: {
        sourceControl: {
          get: {
            queryOptions: sourceControlGetQueryOptionsMock,
          },
          listRepositories: {
            queryOptions: sourceControlListRepositoriesQueryOptionsMock,
          },
        },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/_components/source-control-settings-client",
  () => ({
    SourceControlSettingsClient: ({ slug }: { slug: string }) => (
      <div>Source control settings for {slug}</div>
    ),
  })
);

const { default: SourceControlSettingsPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/source-control/page"
);

beforeEach(() => {
  sourceControlGetQueryOptionsMock.mockClear();
  sourceControlListRepositoriesQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("source control settings page", () => {
  it("prefetches the source-control connection and repositories", async () => {
    const element = await SourceControlSettingsPage({
      params: Promise.resolve({ slug: "acme" }),
    });
    render(element);

    expect(sourceControlGetQueryOptionsMock).toHaveBeenCalledOnce();
    expect(
      sourceControlListRepositoriesQueryOptionsMock
    ).toHaveBeenCalledOnce();
    expect(prefetchMock).toHaveBeenCalledWith({
      queryKey: ["org", "settings", "sourceControl", "get"],
    });
    expect(prefetchMock).toHaveBeenCalledWith({
      queryKey: ["org", "settings", "sourceControl", "listRepositories"],
    });
    expect(screen.getByTestId("hydrated-source-control")).toHaveTextContent(
      "Source control settings for acme"
    );
  });
});
