import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "settings", "orgMembers", "list"],
}));
const prefetchMock = vi.fn();

vi.mock("@repo/app-trpc/server", () => ({
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
  listQueryOptionsMock.mockClear();
  prefetchMock.mockClear();
});

describe("members settings page", () => {
  it("prefetches the org members list before rendering hydrated client islands", async () => {
    const element = await MembersPage();
    render(element);

    expect(listQueryOptionsMock).toHaveBeenCalledOnce();
    expect(prefetchMock).toHaveBeenCalledWith({
      queryKey: ["org", "settings", "orgMembers", "list"],
    });
    expect(screen.getByTestId("hydrated-members")).toContainElement(
      screen.getByRole("button", { name: "Invite" })
    );
    expect(screen.getByTestId("hydrated-members")).toHaveTextContent(
      "Member rows"
    );
  });
});
