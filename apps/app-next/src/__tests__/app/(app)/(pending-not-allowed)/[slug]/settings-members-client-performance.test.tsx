import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orgMemberList: vi.fn(),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useDeferredValue: vi.fn((value: string) =>
      value ? `deferred:${value}` : value
    ),
  };
});

vi.mock("@repo/ui/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
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
    OrgMemberList: ({ searchQuery }: { searchQuery?: string }) => {
      mocks.orgMemberList(searchQuery);
      return <div data-testid="member-list-search">{searchQuery}</div>;
    },
  })
);

const { OrgMembersClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/members/_components/org-members-client"
);

describe("members settings client performance boundaries", () => {
  it("renders the members toolbar with a section heading and invite action", () => {
    render(<OrgMembersClient />);

    expect(screen.getByRole("heading", { name: "Team members" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Invite" })).toBeVisible();
    expect(screen.getByLabelText("Search members")).toBeVisible();
  });

  it("passes deferred search input to the member list", () => {
    render(<OrgMembersClient />);

    fireEvent.change(screen.getByLabelText("Search members"), {
      target: { value: "ada" },
    });

    expect(screen.getByTestId("member-list-search")).toHaveTextContent(
      "deferred:ada"
    );
    expect(mocks.orgMemberList).toHaveBeenLastCalledWith("deferred:ada");
  });
});
