import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listUserOrganizationsQueryOptionsMock = vi.fn(() => ({
  queryKey: ["viewer", "organization", "listUserOrganizations"],
}));
const sourceControlGetQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "sourceControl", "get"],
}));
const updateNameMutationOptionsMock = vi.fn((options: unknown) => options);
const useSuspenseQueryMock = vi.fn();

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        organization: {
          updateName: {
            mutationOptions: updateNameMutationOptionsMock,
          },
        },
        sourceControl: {
          get: {
            queryOptions: sourceControlGetQueryOptionsMock,
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
  useSuspenseQuery: useSuspenseQueryMock,
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

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/source-control-connection-section",
  () => ({
    SourceControlConnectionSection: ({
      connection,
      orgSlug,
    }: {
      connection: { providerAccountLogin: string | null } | null;
      orgSlug: string;
    }) => (
      <div data-testid="source-control-section">
        {orgSlug}:{connection?.providerAccountLogin ?? "unbound"}
      </div>
    ),
  })
);

const { TeamGeneralSettingsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/_components/team-general-settings-client"
);

beforeEach(() => {
  listUserOrganizationsQueryOptionsMock.mockClear();
  sourceControlGetQueryOptionsMock.mockClear();
  updateNameMutationOptionsMock.mockClear();
  useSuspenseQueryMock.mockReset();
  useSuspenseQueryMock.mockImplementation(
    (options: { queryKey: readonly unknown[] }) => {
      if (options.queryKey[0] === "viewer") {
        return {
          data: [{ initials: "AI", slug: "acme" }],
        };
      }

      return {
        data: {
          binding: {
            connectedAt: new Date("2026-05-29T01:02:03.000Z"),
            connectedByUserId: "user_admin",
            provider: "github",
            providerAccountId: "987654",
            providerAccountLogin: "lightfast-emulated",
            providerInstallationId: "1001",
            status: "active",
          },
          status: "bound",
        },
      };
    }
  );
});

describe("TeamGeneralSettingsClient", () => {
  it("loads and renders the read-only GitHub connection section on General settings", () => {
    render(<TeamGeneralSettingsClient slug="acme" />);

    expect(sourceControlGetQueryOptionsMock).toHaveBeenCalled();
    expect(screen.getByTestId("source-control-section")).toHaveTextContent(
      "acme:lightfast-emulated"
    );
  });
});
