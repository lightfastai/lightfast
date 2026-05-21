import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type MutationName = "invite" | "remove" | "revokeInvitation" | "updateRole";
interface CapturedMutationOptions {
  mutationName?: MutationName;
  onError?: (error: unknown, input: unknown, context: unknown) => unknown;
  onMutate?: (input: unknown) => unknown;
  onSettled?: () => unknown;
  onSuccess?: (data: unknown, input: unknown, context: unknown) => unknown;
}

const capturedMutationOptions: Partial<
  Record<MutationName, CapturedMutationOptions>
> = {};
const invalidateQueriesMock = vi.fn();
const cancelQueriesMock = vi.fn();
const getQueryDataMock = vi.fn();
const setQueryDataMock = vi.fn();
const inviteMutateMock = vi.fn();
const removeMutateMock = vi.fn();
const revokeInvitationMutateMock = vi.fn();
const toastSuccessMock = vi.fn();
const updateRoleMutateMock = vi.fn();
const useAuthMock = vi.fn();
const useMutationMock = vi.fn();
const useSuspenseQueryMock = vi.fn();

const listQueryOptions = {
  queryKey: ["org", "settings", "orgMembers", "list"],
};

vi.mock("@repo/app-trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        orgMembers: {
          invite: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "invite",
            }),
          },
          list: {
            queryOptions: () => listQueryOptions,
          },
          remove: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "remove",
            }),
          },
          revokeInvitation: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "revokeInvitation",
            }),
          },
          updateRole: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "updateRole",
            }),
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: useMutationMock,
  useQueryClient: () => ({
    cancelQueries: cancelQueriesMock,
    getQueryData: getQueryDataMock,
    invalidateQueries: invalidateQueriesMock,
    setQueryData: setQueryDataMock,
  }),
  useSuspenseQuery: useSuspenseQueryMock,
}));

vi.mock("@vendor/clerk/client", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: {
    success: toastSuccessMock,
  },
}));

vi.mock("@repo/ui/components/ui/avatar", () => ({
  Avatar: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  AvatarFallback: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  AvatarImage: () => null,
}));

vi.mock("@repo/ui/components/ui/button", () => ({
  Button: ({
    children,
    size: _size,
    variant: _variant,
    ...props
  }: {
    children?: ReactNode;
    size?: string;
    variant?: string;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@repo/ui/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    variant: _variant,
    ...props
  }: {
    children?: ReactNode;
    variant?: string;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@repo/ui/components/ui/select", () => ({
  Select: ({
    disabled,
    onValueChange,
    value,
  }: {
    disabled?: boolean;
    onValueChange?: (value: string) => void;
    value?: string;
  }) => (
    <select
      aria-label="Role"
      disabled={disabled}
      onChange={(event) => onValueChange?.(event.currentTarget.value)}
      value={value}
    >
      <option value="org:member">Member</option>
      <option value="org:admin">Admin</option>
    </select>
  ),
  SelectContent: () => null,
  SelectItem: () => null,
  SelectTrigger: () => null,
  SelectValue: () => null,
}));

vi.mock("@repo/ui/components/ui/dialog", () => ({
  Dialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogActionButton: ({
    children,
    variant: _variant,
    ...props
  }: {
    children?: ReactNode;
    variant?: "default" | "primary" | "destructive";
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DialogActions: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogClose: ({ children }: { children?: ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children?: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogHeader: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

vi.mock("@repo/ui/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

const { OrgMemberInvite } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/members/_components/org-member-invite"
);
const { OrgMemberList } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/members/_components/org-member-list"
);
const { OrgMembersClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/members/_components/org-members-client"
);

const membersData = {
  invitations: [
    {
      createdAt: 1_700_000_002_000,
      emailAddress: "invite@example.com",
      expiresAt: 1_700_086_400_000,
      id: "inv_1",
      role: "org:member",
      roleName: "Member",
      status: "pending",
      updatedAt: 1_700_000_002_000,
    },
  ],
  members: [
    {
      createdAt: 1_700_000_000_000,
      emailAddress: "ada@example.com",
      firstName: "Ada",
      id: "mem_ada",
      imageUrl: "",
      isCurrentUser: true,
      lastName: "Lovelace",
      name: "Ada Lovelace",
      role: "org:admin",
      updatedAt: 1_700_000_000_000,
      userId: "user_ada",
    },
    {
      createdAt: 1_700_000_001_000,
      emailAddress: "grace@example.com",
      firstName: "Grace",
      id: "mem_grace",
      imageUrl: "",
      isCurrentUser: false,
      lastName: "Hopper",
      name: "Grace Hopper",
      role: "org:member",
      updatedAt: 1_700_000_001_000,
      userId: "user_grace",
    },
  ],
};

function mutationResult(name: MutationName) {
  switch (name) {
    case "invite":
      return { isPending: false, mutate: inviteMutateMock };
    case "remove":
      return { isPending: false, mutate: removeMutateMock };
    case "revokeInvitation":
      return { isPending: false, mutate: revokeInvitationMutateMock };
    case "updateRole":
      return { isPending: false, mutate: updateRoleMutateMock };
    default:
      throw new Error(`Unhandled mutation: ${name}`);
  }
}

beforeEach(() => {
  for (const key of Object.keys(capturedMutationOptions)) {
    delete capturedMutationOptions[key as MutationName];
  }
  cancelQueriesMock.mockReset();
  getQueryDataMock.mockReset();
  invalidateQueriesMock.mockReset();
  inviteMutateMock.mockReset();
  removeMutateMock.mockReset();
  revokeInvitationMutateMock.mockReset();
  setQueryDataMock.mockReset();
  toastSuccessMock.mockReset();
  updateRoleMutateMock.mockReset();
  useAuthMock.mockReset();
  useMutationMock.mockReset();
  useSuspenseQueryMock.mockReset();

  useAuthMock.mockReturnValue({
    has: ({ role }: { role?: string }) => role === "org:admin",
    isLoaded: true,
  });
  useMutationMock.mockImplementation(
    (options: CapturedMutationOptions & { mutationName: MutationName }) => {
      capturedMutationOptions[options.mutationName] = options;
      return mutationResult(options.mutationName);
    }
  );
  useSuspenseQueryMock.mockReturnValue({ data: membersData });
});

describe("members settings client components", () => {
  it("lets admins update roles, remove members, and revoke invitations", () => {
    render(<OrgMemberList />);

    fireEvent.change(screen.getByLabelText("Role"), {
      target: { value: "org:admin" },
    });
    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    fireEvent.click(screen.getByRole("button", { name: /revoke/i }));

    expect(updateRoleMutateMock).toHaveBeenCalledWith({
      role: "org:admin",
      userId: "user_grace",
    });
    expect(removeMutateMock).toHaveBeenCalledWith({ userId: "user_grace" });
    expect(revokeInvitationMutateMock).toHaveBeenCalledWith({
      invitationId: "inv_1",
    });
  });

  it("hides invite and row management controls from non-admin members", () => {
    useAuthMock.mockReturnValue({
      has: () => false,
      isLoaded: true,
    });

    render(
      <>
        <OrgMemberInvite />
        <OrgMemberList />
      </>
    );

    expect(screen.queryByRole("button", { name: /invite/i })).toBeNull();
    expect(screen.queryByLabelText("Role")).toBeNull();
    expect(screen.queryByRole("button", { name: /remove/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /revoke/i })).toBeNull();
  });

  it("configures invite with optimistic insert, replacement, rollback, and invalidation", async () => {
    render(<OrgMemberInvite />);
    getQueryDataMock.mockReturnValue(membersData);

    let context: { optimisticInvitationId: string } | undefined;
    await act(async () => {
      context = (await capturedMutationOptions.invite?.onMutate?.({
        emailAddress: "new@example.com",
        role: "org:member",
      })) as { optimisticInvitationId: string } | undefined;
    });

    expect(cancelQueriesMock).toHaveBeenCalledWith({
      queryKey: listQueryOptions.queryKey,
    });
    expect(setQueryDataMock).toHaveBeenCalledWith(
      listQueryOptions.queryKey,
      expect.any(Function)
    );

    const optimisticData = setQueryDataMock.mock.calls.at(-1)?.[1](membersData);
    expect(optimisticData.invitations[0]).toMatchObject({
      emailAddress: "new@example.com",
      role: "org:member",
      status: "pending",
    });
    expect(optimisticData.invitations[0].id).toMatch(/^optimistic:/);

    const createdInvitation = {
      ...membersData.invitations[0],
      emailAddress: "new@example.com",
      id: "inv_real",
    };
    await act(async () => {
      capturedMutationOptions.invite?.onSuccess?.(
        createdInvitation,
        { emailAddress: "new@example.com", role: "org:member" },
        context
      );
    });
    const replacedData =
      setQueryDataMock.mock.calls.at(-1)?.[1](optimisticData);
    expect(replacedData.invitations[0]).toEqual(createdInvitation);
    expect(toastSuccessMock).toHaveBeenCalledWith("Invitation sent");

    await act(async () => {
      capturedMutationOptions.invite?.onError?.(
        new Error("failed"),
        { emailAddress: "new@example.com", role: "org:member" },
        context
      );
    });
    const rolledBackData =
      setQueryDataMock.mock.calls.at(-1)?.[1](optimisticData);
    expect(
      rolledBackData.invitations.some(
        (invitation: { id: string }) =>
          invitation.id === context?.optimisticInvitationId
      )
    ).toBe(false);

    capturedMutationOptions.invite?.onSettled?.();
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: listQueryOptions.queryKey,
    });
  });

  it("configures member row mutations with targeted optimistic writes and invalidation", async () => {
    render(<OrgMemberList />);
    getQueryDataMock.mockReturnValue(membersData);

    const roleContext = await capturedMutationOptions.updateRole?.onMutate?.({
      role: "org:admin",
      userId: "user_grace",
    });
    const roleData = setQueryDataMock.mock.calls.at(-1)?.[1](membersData);
    expect(
      roleData.members.find(
        (member: { userId: string }) => member.userId === "user_grace"
      ).role
    ).toBe("org:admin");

    capturedMutationOptions.updateRole?.onError?.(
      new Error("failed"),
      { role: "org:admin", userId: "user_grace" },
      roleContext
    );
    const rollbackRoleData = setQueryDataMock.mock.calls.at(-1)?.[1](roleData);
    expect(
      rollbackRoleData.members.find(
        (member: { userId: string }) => member.userId === "user_grace"
      ).role
    ).toBe("org:member");

    const removeContext = await capturedMutationOptions.remove?.onMutate?.({
      userId: "user_grace",
    });
    const removedData = setQueryDataMock.mock.calls.at(-1)?.[1](membersData);
    expect(
      removedData.members.some(
        (member: { userId: string }) => member.userId === "user_grace"
      )
    ).toBe(false);

    capturedMutationOptions.remove?.onError?.(
      new Error("failed"),
      { userId: "user_grace" },
      removeContext
    );
    const restoredData = setQueryDataMock.mock.calls.at(-1)?.[1](removedData);
    expect(
      restoredData.members.map((member: { userId: string }) => member.userId)
    ).toEqual(["user_ada", "user_grace"]);

    capturedMutationOptions.updateRole?.onSettled?.();
    capturedMutationOptions.remove?.onSettled?.();
    capturedMutationOptions.revokeInvitation?.onSettled?.();
    expect(invalidateQueriesMock).toHaveBeenCalledTimes(3);
  });
});

describe("members settings search", () => {
  it("filters members by name via the OrgMemberList searchQuery prop", () => {
    render(<OrgMemberList searchQuery="grace" />);

    expect(screen.getByText("Grace Hopper")).toBeTruthy();
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
    expect(screen.queryByText("invite@example.com")).toBeNull();
  });

  it("matches pending invitations by email", () => {
    render(<OrgMemberList searchQuery="invite@" />);

    expect(screen.getByText("invite@example.com")).toBeTruthy();
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
    expect(screen.queryByText("Grace Hopper")).toBeNull();
  });

  it("shows an empty state when nothing matches the search", () => {
    render(<OrgMemberList searchQuery="no-such-person" />);

    expect(screen.getByText("No members found")).toBeTruthy();
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
    expect(screen.queryByText("invite@example.com")).toBeNull();
  });

  it("filters the list as the user types in the toolbar search input", () => {
    render(<OrgMembersClient />);

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Grace Hopper")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Search members"), {
      target: { value: "ada" },
    });

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByText("Grace Hopper")).toBeNull();
  });
});
