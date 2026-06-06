import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const identityGetQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "identity", "get"],
}));
const listDomainsQueryOptionsMock = vi.fn((input: { slug: string }) => ({
  input,
  queryKey: ["org", "settings", "organization", "listDomains", input.slug],
}));
const listUserOrganizationsQueryOptionsMock = vi.fn(() => ({
  queryKey: ["viewer", "organization", "listUserOrganizations"],
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
        identity: {
          get: {
            queryOptions: identityGetQueryOptionsMock,
          },
        },
        organization: {
          listDomains: {
            queryOptions: listDomainsQueryOptionsMock,
          },
        },
      },
    },
    viewer: {
      organization: {
        listUserOrganizations: {
          queryOptions: listUserOrganizationsQueryOptionsMock,
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

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/identity-soul-card",
  () => ({
    IdentitySoulCard: ({ slug }: { slug: string }) => (
      <div>Identity and soul for {slug}</div>
    ),
  })
);

const { default: SettingsPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/page"
);

beforeEach(() => {
  identityGetQueryOptionsMock.mockClear();
  listDomainsQueryOptionsMock.mockClear();
  listUserOrganizationsQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("general settings page", () => {
  it("prefetches the General settings queries", async () => {
    const element = await SettingsPage({
      params: Promise.resolve({ slug: "acme" }),
    });
    render(element);

    expect(identityGetQueryOptionsMock).toHaveBeenCalledOnce();
    expect(listDomainsQueryOptionsMock).toHaveBeenCalledWith({
      slug: "acme",
    });
    expect(listUserOrganizationsQueryOptionsMock).toHaveBeenCalledOnce();
    expect(prefetchMock).toHaveBeenCalledWith({
      queryKey: ["org", "settings", "identity", "get"],
    });
    expect(prefetchMock).toHaveBeenCalledWith({
      input: { slug: "acme" },
      queryKey: ["org", "settings", "organization", "listDomains", "acme"],
    });
    expect(prefetchMock).toHaveBeenCalledWith({
      queryKey: ["viewer", "organization", "listUserOrganizations"],
    });
    expect(screen.getByTestId("hydrated-general")).toHaveTextContent(
      "General settings for acme"
    );
    expect(screen.getByTestId("hydrated-general")).toHaveTextContent(
      "Identity and soul for acme"
    );
  });
});
