import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type MutationName = "create" | "delete" | "revoke";
interface CapturedMutationOptions {
  mutationName?: MutationName;
  onError?: (error: unknown, input: unknown, context: unknown) => unknown;
  onMutate?: (input: unknown) => unknown;
  onSettled?: () => unknown;
  onSuccess?: () => unknown;
}

const capturedMutationOptions: Partial<
  Record<MutationName, CapturedMutationOptions>
> = {};
const cancelQueriesMock = vi.fn();
const createMutateMock = vi.fn();
const deleteMutateMock = vi.fn();
const getQueryDataMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const revokeMutateMock = vi.fn();
const setQueryDataMock = vi.fn();
const toastSuccessMock = vi.fn();
const useAuthMock = vi.fn();
const useMutationMock = vi.fn();
const useSuspenseQueryMock = vi.fn();

const listQueryOptions = {
  queryKey: ["org", "settings", "orgApiKeys", "list"],
};

vi.mock("@repo/app-trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        orgApiKeys: {
          create: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "create",
            }),
          },
          delete: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "delete",
            }),
          },
          list: {
            queryOptions: () => listQueryOptions,
          },
          revoke: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "revoke",
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

vi.mock("@vendor/clerk", () => ({
  useAuth: useAuthMock,
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: {
    success: toastSuccessMock,
  },
}));

vi.mock("@repo/ui/components/ui/dialog", () => ({
  Dialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children?: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogFooter: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
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

vi.mock("@repo/ui/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogAction: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogCancel: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  AlertDialogContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children?: ReactNode }) => (
    <p>{children}</p>
  ),
  AlertDialogFooter: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children?: ReactNode }) => (
    <h2>{children}</h2>
  ),
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

const { OrgApiKeyList } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/api-keys/_components/org-api-key-list"
);
const { OrgApiKeyCreate } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/api-keys/_components/org-api-key-create"
);

const apiKeys = [
  {
    createdAt: 1_700_000_000_000,
    createdBy: "user_ada",
    expired: false,
    id: "ak_active",
    lastUsedAt: null,
    name: "Production",
    revoked: false,
    subject: "org_acme",
    updatedAt: 1_700_000_000_000,
  },
  {
    createdAt: 1_700_000_001_000,
    createdBy: "user_ada",
    expired: false,
    id: "ak_other",
    lastUsedAt: null,
    name: "Other",
    revoked: false,
    subject: "org_acme",
    updatedAt: 1_700_000_001_000,
  },
];

function mutationResult(name: MutationName) {
  switch (name) {
    case "create":
      return { isPending: false, mutate: createMutateMock, reset: vi.fn() };
    case "delete":
      return { isPending: false, mutate: deleteMutateMock };
    case "revoke":
      return { isPending: false, mutate: revokeMutateMock };
    default:
      throw new Error(`Unhandled mutation: ${name}`);
  }
}

beforeEach(() => {
  for (const key of Object.keys(capturedMutationOptions)) {
    delete capturedMutationOptions[key as MutationName];
  }
  cancelQueriesMock.mockReset();
  createMutateMock.mockReset();
  deleteMutateMock.mockReset();
  getQueryDataMock.mockReset();
  invalidateQueriesMock.mockReset();
  revokeMutateMock.mockReset();
  setQueryDataMock.mockReset();
  toastSuccessMock.mockReset();
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
  useSuspenseQueryMock.mockReturnValue({ data: apiKeys });
});

describe("api key settings admin controls", () => {
  it("shows create and row management controls to admins", () => {
    render(
      <>
        <OrgApiKeyCreate />
        <OrgApiKeyList />
      </>
    );

    expect(screen.getByRole("button", { name: /create key/i })).toBeVisible();
    expect(screen.getAllByRole("button", { name: /actions/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /^revoke$/i })).toHaveLength(
      2
    );
    expect(screen.getAllByRole("button", { name: /^delete$/i })).toHaveLength(
      2
    );
  });

  it("hides create and row management controls from non-admin members", () => {
    useAuthMock.mockReturnValue({
      has: () => false,
      isLoaded: true,
    });

    render(
      <>
        <OrgApiKeyCreate />
        <OrgApiKeyList />
      </>
    );

    expect(screen.queryByRole("button", { name: /create key/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /actions/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^revoke$/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^delete$/i })).toBeNull();
  });

  it("uses admin-managed empty-state copy for non-admin members", () => {
    useAuthMock.mockReturnValue({
      has: () => false,
      isLoaded: true,
    });
    useSuspenseQueryMock.mockReturnValue({ data: [] });

    render(<OrgApiKeyList />);

    expect(
      screen.getByText("Ask an organization admin to create API keys.")
    ).toBeVisible();
    expect(
      screen.queryByText(
        "Create an API key to access your organization's resources programmatically."
      )
    ).toBeNull();
  });
});

describe("api key settings list optimistic mutations", () => {
  it("optimistically revokes a key, rolls back on error, and invalidates", async () => {
    render(<OrgApiKeyList />);
    getQueryDataMock.mockReturnValue(apiKeys);

    const context = await capturedMutationOptions.revoke?.onMutate?.({
      keyId: "ak_active",
    });

    expect(cancelQueriesMock).toHaveBeenCalledWith({
      queryKey: listQueryOptions.queryKey,
    });
    const revokedData = setQueryDataMock.mock.calls.at(-1)?.[1](apiKeys);
    expect(revokedData[0]).toMatchObject({
      id: "ak_active",
      revoked: true,
    });

    capturedMutationOptions.revoke?.onError?.(
      new Error("failed"),
      { keyId: "ak_active" },
      context
    );
    const rollbackData = setQueryDataMock.mock.calls.at(-1)?.[1](revokedData);
    expect(rollbackData[0]).toMatchObject({
      id: "ak_active",
      revoked: false,
    });

    capturedMutationOptions.revoke?.onSettled?.();
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: listQueryOptions.queryKey,
    });
  });

  it("optimistically deletes a key, restores it on error, and invalidates", async () => {
    render(<OrgApiKeyList />);
    getQueryDataMock.mockReturnValue(apiKeys);

    const context = await capturedMutationOptions.delete?.onMutate?.({
      keyId: "ak_active",
    });

    const deletedData = setQueryDataMock.mock.calls.at(-1)?.[1](apiKeys);
    expect(deletedData.map((key: { id: string }) => key.id)).toEqual([
      "ak_other",
    ]);

    capturedMutationOptions.delete?.onError?.(
      new Error("failed"),
      { keyId: "ak_active" },
      context
    );
    const restoredData = setQueryDataMock.mock.calls.at(-1)?.[1](deletedData);
    expect(restoredData.map((key: { id: string }) => key.id)).toEqual([
      "ak_active",
      "ak_other",
    ]);

    capturedMutationOptions.delete?.onSettled?.();
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: listQueryOptions.queryKey,
    });
  });
});
