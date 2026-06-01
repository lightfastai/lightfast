import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface CapturedMutationOptions {
  mutationName?: "revoke";
  onSettled?: () => unknown;
  onSuccess?: () => unknown;
}

const invalidateQueriesMock = vi.fn();
const revokeMutateMock = vi.fn();
const toastSuccessMock = vi.fn();
const useMutationMock = vi.fn();
const useSuspenseQueryMock = vi.fn();

const listQueryOptions = {
  queryKey: ["org", "settings", "mcpConnections", "list"],
};

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      settings: {
        mcpConnections: {
          list: {
            queryFilter: () => ({ queryKey: listQueryOptions.queryKey }),
            queryKey: () => listQueryOptions.queryKey,
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
    invalidateQueries: invalidateQueriesMock,
  }),
  useSuspenseQuery: useSuspenseQueryMock,
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: { success: toastSuccessMock },
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

vi.mock("@repo/ui/components/ui/sheet", () => ({
  Sheet: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children?: ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  SheetDescription: ({ children }: { children?: ReactNode }) => (
    <p>{children}</p>
  ),
  SheetHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@repo/ui/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogAction: ({
    children,
    ...props
  }: { children?: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
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

const { McpConnectionsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/(manage)/settings/mcp/_components/mcp-connections-client"
);

const connections = [
  {
    clientId: "mcp_client_test",
    clientName: "Lightfield",
    clientPolicyUri: "https://lightfield.app/policy",
    clientUri: "https://lightfield.app",
    clientVerificationStatus: "verified",
    connectedUserId: "user_current",
    createdAt: "2026-06-01T00:00:00.000Z",
    grantId: "mcp_grant_test",
    lastUsedAt: "2026-06-01T00:05:00.000Z",
    logoUri: null,
    redirectUris: ["https://backend.lightfield.app/connections/callback/MCP"],
    refreshTokenStatusSummary: {
      active: 1,
      reuseDetected: 0,
      revoked: 0,
      rotated: 0,
    },
    resource: "https://mcp.lightfast.localhost/mcp",
    revokedAt: null,
    scopes: ["mcp:signals:read", "mcp:signals:write"],
    status: "active",
  },
];

beforeEach(() => {
  invalidateQueriesMock.mockReset();
  revokeMutateMock.mockReset();
  toastSuccessMock.mockReset();
  useMutationMock.mockReset();
  useSuspenseQueryMock.mockReset();

  useSuspenseQueryMock.mockReturnValue({ data: connections });
  useMutationMock.mockImplementation(
    (options: CapturedMutationOptions & { mutationName: "revoke" }) => ({
      isPending: false,
      mutate: revokeMutateMock,
      variables: undefined,
      ...options,
    })
  );
});

describe("MCP settings page", () => {
  it("renders MCP connection summary rows", async () => {
    render(<McpConnectionsClient />);

    expect(screen.getByText("Lightfield")).toBeVisible();
    expect(screen.getByText("Verified")).toBeVisible();
    expect(screen.getByText("user_current")).toBeVisible();
    expect(screen.getByText("Read and write signals")).toBeVisible();
  });

  it("opens technical details in a sheet", async () => {
    render(<McpConnectionsClient />);

    expect(screen.queryByText("mcp_grant_test")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /details for lightfield/i })
    );

    expect(screen.getByRole("dialog")).toHaveTextContent("mcp_grant_test");
    expect(screen.getByRole("dialog")).toHaveTextContent("mcp_client_test");
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "https://backend.lightfield.app/connections/callback/MCP"
    );
  });

  it("revokes a grant after confirmation", async () => {
    render(<McpConnectionsClient />);

    fireEvent.click(
      screen.getByRole("button", { name: /revoke lightfield/i })
    );
    fireEvent.click(
      screen.getByRole("button", { name: /revoke connection/i })
    );

    expect(revokeMutateMock).toHaveBeenCalledWith({
      grantId: "mcp_grant_test",
    });
  });
});
