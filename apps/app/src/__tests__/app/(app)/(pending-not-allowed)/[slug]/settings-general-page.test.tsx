import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sourceControlGetQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "sourceControl", "get"],
}));
const sourceControlListRepositoriesQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "sourceControl", "listRepositories"],
}));
const identityGetQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "identity", "get"],
}));
const prefetchMock = vi.fn();

vi.mock("~/trpc/server", () => ({
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-general">{children}</div>
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
        identity: {
          get: {
            queryOptions: identityGetQueryOptionsMock,
          },
        },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client",
  () => ({
    TeamGeneralSettingsClient: ({ slug }: { slug: string }) => (
      <div>General settings for {slug}</div>
    ),
  })
);

const { default: SettingsPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/page"
);

beforeEach(() => {
  sourceControlGetQueryOptionsMock.mockClear();
  sourceControlListRepositoriesQueryOptionsMock.mockClear();
  identityGetQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("general settings page", () => {
  it("prefetches the read-only source-control connection in the General settings surface", async () => {
    const element = await SettingsPage({
      params: Promise.resolve({ slug: "acme" }),
    });
    render(element);

    expect(sourceControlGetQueryOptionsMock).toHaveBeenCalledOnce();
    expect(
      sourceControlListRepositoriesQueryOptionsMock
    ).toHaveBeenCalledOnce();
    expect(identityGetQueryOptionsMock).toHaveBeenCalledOnce();
    expect(prefetchMock).toHaveBeenCalledWith({
      queryKey: ["org", "settings", "sourceControl", "get"],
    });
    expect(prefetchMock).toHaveBeenCalledWith({
      queryKey: ["org", "settings", "sourceControl", "listRepositories"],
    });
    expect(prefetchMock).toHaveBeenCalledWith({
      queryKey: ["org", "settings", "identity", "get"],
    });
    expect(screen.getByTestId("hydrated-general")).toHaveTextContent(
      "General settings for acme"
    );
  });
});
