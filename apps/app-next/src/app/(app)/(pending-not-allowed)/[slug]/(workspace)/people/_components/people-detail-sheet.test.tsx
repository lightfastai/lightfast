import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PeopleDetailSheet } from "./people-detail-sheet";
import type { PersonRow } from "./people-model";

const useQueryMock = vi.fn();
const getQueryOptionsMock = vi.fn((input: unknown, opts: unknown) => ({
  input,
  opts,
}));
const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQueryMock(options),
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        people: { get: { queryOptions: getQueryOptionsMock } },
        signals: { get: { queryOptions: () => ({ queryKey: ["signal"] }) } },
      },
    },
  }),
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: { error: toastMocks.error, success: toastMocks.success },
}));

const personRow = {
  clerkOrgId: "org_test",
  createdAt: new Date("2026-05-27T01:00:00.000Z"),
  displayName: "Jeevan Pillay",
  firstSeenSignalId: null,
  id: 1,
  identityKey: "identity_key",
  identityProvider: "x",
  identityType: "handle",
  identityValue: "@jeevanp",
  lastSeenSignalId: null,
  clerkUserId: null,
  memberRole: null,
  memberStatus: null,
  memberSyncedAt: null,
  metadata: {},
  normalizedIdentityValue: "jeevanp",
  personSource: "signal",
  publicId: "person_123e4567-e89b-12d3-a456-426614174000",
  seenCount: 1,
  updatedAt: new Date("2026-05-27T01:01:00.000Z"),
} as PersonRow;

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
  useQueryMock.mockReturnValue({
    data: undefined,
    isError: false,
    isLoading: false,
  });
});

describe("PeopleDetailSheet", () => {
  it("wires a dialog description for assistive technology", () => {
    render(
      <PeopleDetailSheet
        initialPerson={personRow}
        onOpenChange={vi.fn()}
        publicId={personRow.publicId}
        slug="acme"
      />
    );

    const descriptionId = screen
      .getByRole("dialog")
      .getAttribute("aria-describedby");

    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId ?? "")).toHaveTextContent(
      "Person details, identity, and related signals."
    );
  });

  it("shows an error toast when copying the person link fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });
    render(
      <PeopleDetailSheet
        initialPerson={personRow}
        onOpenChange={vi.fn()}
        publicId={personRow.publicId}
        slug="acme"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /copy link/i }));

    await waitFor(() =>
      expect(toastMocks.error).toHaveBeenCalledWith("Unable to copy link")
    );
    expect(toastMocks.success).not.toHaveBeenCalled();
  });

  it("renders team member metadata", () => {
    render(
      <PeopleDetailSheet
        initialPerson={{
          ...personRow,
          memberRole: "org:member",
          memberStatus: "active",
          memberSyncedAt: new Date("2026-05-27T01:02:00.000Z"),
          personSource: "mixed",
        }}
        onOpenChange={vi.fn()}
        publicId={personRow.publicId}
        slug="acme"
      />
    );

    expect(screen.getByText("Team member")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getAllByText("Member")).toHaveLength(2);
    expect(screen.getByText("Synced from Clerk")).toBeInTheDocument();
  });

  it("renders former team member metadata", () => {
    render(
      <PeopleDetailSheet
        initialPerson={{
          ...personRow,
          memberRole: "org:admin",
          memberStatus: "former",
          memberSyncedAt: new Date("2026-05-27T01:02:00.000Z"),
          personSource: "team_member",
        }}
        onOpenChange={vi.fn()}
        publicId={personRow.publicId}
        slug="acme"
      />
    );

    expect(screen.getByText("Former team member")).toBeInTheDocument();
    expect(screen.getByText("Role")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Synced from Clerk")).toBeInTheDocument();
  });

  it("does not clear the person query when a linked signal navigation closes the sheet", () => {
    const onOpenChange = vi.fn();

    render(
      <PeopleDetailSheet
        initialPerson={{
          ...personRow,
          lastSeenSignalId: "signal_123e4567-e89b-12d3-a456-426614174000",
        }}
        onOpenChange={onOpenChange}
        publicId={personRow.publicId}
        slug="acme"
      />
    );

    fireEvent.pointerDown(screen.getByRole("link", { name: /Open signal/i }));
    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
