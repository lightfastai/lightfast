import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const domainsQueryOptions = {
  queryKey: ["org", "settings", "organization", "listDomains", "acme"],
};
const listUserOrganizationsQueryOptionsMock = vi.fn(() => ({
  queryKey: ["viewer", "organization", "listUserOrganizations"],
}));
const listDomainsQueryOptionsMock = vi.fn((input: { slug: string }) => ({
  ...domainsQueryOptions,
  input,
}));
const updateDomainsMutationOptionsMock = vi.fn((options: unknown) => options);
const updateNameMutationOptionsMock = vi.fn((options: unknown) => options);

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        organization: {
          listDomains: {
            queryOptions: listDomainsQueryOptionsMock,
          },
          updateDomains: {
            mutationOptions: updateDomainsMutationOptionsMock,
          },
          updateName: {
            mutationOptions: updateNameMutationOptionsMock,
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
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    isPending: false,
    mutate: vi.fn(),
  }),
  useQueryClient: () => ({
    cancelQueries: vi.fn(),
    getQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  }),
  useSuspenseQuery: vi.fn((options: { queryKey: string[] }) => {
    if (options.queryKey === domainsQueryOptions.queryKey) {
      return {
        data: [
          { id: "orgdmn_1", name: "jeevanpillay.com" },
          { id: "orgdmn_2", name: "lightfast.ai" },
        ],
      };
    }
    return {
      data: [{ initials: "AI", slug: "acme" }],
    };
  }),
}));

vi.mock("@vendor/clerk", () => ({
  useOrganizationList: () => ({
    setActive: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const { TeamGeneralSettingsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client"
);

beforeEach(() => {
  listDomainsQueryOptionsMock.mockClear();
  listUserOrganizationsQueryOptionsMock.mockClear();
  updateDomainsMutationOptionsMock.mockClear();
  updateNameMutationOptionsMock.mockClear();
});

describe("TeamGeneralSettingsClient", () => {
  it("renders the reworked Profile group", () => {
    render(<TeamGeneralSettingsClient slug="acme" />);

    expect(screen.getByRole("heading", { name: "Profile" })).toBeVisible();
    expect(screen.getByText("Avatar")).toBeVisible();
    expect(screen.getByText("Team name")).toBeVisible();
    expect(screen.getByLabelText("Team name")).toHaveValue("acme");
  });

  it("renders the Domains controls in General settings", () => {
    render(<TeamGeneralSettingsClient slug="acme" />);

    expect(screen.getByText("Domains")).toBeVisible();
    expect(
      screen.getByText(
        "People with matching email domains will automatically join this team."
      )
    ).toBeVisible();
    expect(screen.getByText("jeevanpillay.com")).toBeVisible();
    expect(screen.getByText("lightfast.ai")).toBeVisible();
    expect(screen.getByLabelText("Add domain")).toBeVisible();
    expect(listDomainsQueryOptionsMock).toHaveBeenCalledWith({
      slug: "acme",
    });
  });
});
