import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchQueryMock = vi.fn();
const listQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "orgMembers", "list"],
}));
const prefetchMock = vi.fn();

vi.mock("@repo/app-trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery: fetchQueryMock }),
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-members">{children}</div>
  ),
  prefetch: prefetchMock,
  trpc: {
    org: {
      settings: {
        orgMembers: {
          list: {
            queryOptions: listQueryOptionsMock,
          },
        },
      },
    },
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/members/_components/org-member-invite",
  () => ({
    OrgMemberInvite: () => <button type="button">Invite</button>,
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/members/_components/org-member-list",
  () => ({
    OrgMemberList: () => <div>Member rows</div>,
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/members/_components/org-member-list-loading",
  () => ({
    OrgMemberListLoading: () => <div>Loading members</div>,
  })
);

const { default: MembersPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/members/page"
);

beforeEach(() => {
  fetchQueryMock.mockReset();
  listQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("members settings page", () => {
  it("awaits the org members list query before rendering hydrated client islands", async () => {
    fetchQueryMock.mockResolvedValue({
      invitations: [],
      members: [],
    });

    const element = await MembersPage();
    render(element);

    expect(listQueryOptionsMock).toHaveBeenCalledOnce();
    expect(fetchQueryMock).toHaveBeenCalledWith({
      queryKey: ["org", "settings", "orgMembers", "list"],
    });
    expect(prefetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("hydrated-members")).toContainElement(
      screen.getByRole("button", { name: "Invite" })
    );
    expect(screen.getByTestId("hydrated-members")).toHaveTextContent(
      "Member rows"
    );
  });
});
