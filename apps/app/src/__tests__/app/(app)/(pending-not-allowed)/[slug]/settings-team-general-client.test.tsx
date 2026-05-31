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
    LightfastRepositorySection: ({
      connection,
      orgSlug,
    }: {
      connection: { accountLogin: string | null } | null;
      orgSlug: string;
    }) => (
      <div data-testid="lightfast-repository-section">
        {orgSlug}:{connection?.accountLogin ?? "unbound"}
      </div>
    ),
    SourceControlConnectionSection: ({
      connection,
      orgSlug,
    }: {
      connection: { accountLogin: string | null } | null;
      orgSlug: string;
    }) => (
      <div data-testid="source-control-section">
        {orgSlug}:{connection?.accountLogin ?? "unbound"}
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
            accountLogin: "lightfast-emulated",
            connectedAt: new Date("2026-05-29T01:02:03.000Z"),
            provider: "github",
            providerLabel: "GitHub",
          },
          status: "bound",
        },
      };
    }
  );
});

describe("TeamGeneralSettingsClient", () => {
  it("loads and renders read-only source-control sections on General settings", () => {
    render(<TeamGeneralSettingsClient slug="acme" />);

    expect(sourceControlGetQueryOptionsMock).toHaveBeenCalled();
    expect(screen.getByTestId("source-control-section")).toHaveTextContent(
      "acme:lightfast-emulated"
    );
    expect(
      screen.getByTestId("lightfast-repository-section")
    ).toHaveTextContent("acme:lightfast-emulated");
  });
});
