import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface DeveloperConnectionRow {
  builder: "Lightfast";
  canManage: boolean;
  catalogStatus: "available" | "coming_soon";
  category: string;
  connectAvailability:
    | { status: "available" }
    | { status: "unavailable"; reason: "coming_soon" | "permission_required" };
  connection: {
    connectedAt: Date;
    enabledForSandboxes: boolean;
    lastUsedAt: Date | null;
    lastUsedByUserId: string | null;
    lastVerifiedAt: Date | null;
    providerAccountName: string;
    status: "connected" | "needs_reconnect" | "revoked" | "replaced";
  } | null;
  description: string;
  displayName: string;
  provider: "pscale" | "upstash" | "sentry" | "clerk";
}

const completeSentryAuthMutateMock = vi.fn();
const connectMutateMock = vi.fn();
const disconnectMutateMock = vi.fn();
const fetchQueryMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const listQueryFilterMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "developerConnections", "list"],
}));
const listQueryOptions = {
  queryKey: ["org", "workspace", "developerConnections", "list"],
};
const listQueryOptionsMock = vi.fn(() => listQueryOptions);
const setSandboxEnabledMutateMock = vi.fn();
const startSentryAuthMutateMock = vi.fn();
const useMutationMock = vi.fn();
const useSuspenseQueryMock = vi.fn();

let connectionState: string | null = null;
let errorState: string | null = null;
const setConnectionMock = vi.fn((value: string | null) => {
  connectionState = value;
});
const setErrorMock = vi.fn((value: string | null) => {
  errorState = value;
});

const capturedMutationOptions: Record<
  string,
  { onSuccess?: (data?: unknown) => void }
> = {};

vi.mock("~/trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery: fetchQueryMock }),
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-developer-connections">{children}</div>
  ),
  trpc: {
    org: {
      workspace: {
        developerConnections: {
          list: {
            queryOptions: listQueryOptionsMock,
          },
        },
      },
    },
  },
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        developerConnections: {
          completeSentryAuth: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "completeSentryAuth",
            }),
          },
          connect: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "connect",
            }),
          },
          disconnect: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "disconnect",
            }),
          },
          list: {
            queryFilter: listQueryFilterMock,
            queryOptions: listQueryOptionsMock,
          },
          setSandboxEnabled: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "setSandboxEnabled",
            }),
          },
          startSentryAuth: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "startSentryAuth",
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

vi.mock("nuqs", () => ({
  useQueryState: (key: string) => {
    if (key === "error") {
      return [errorState, setErrorMock];
    }
    return [connectionState, setConnectionMock];
  },
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

vi.mock("@repo/ui/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children?: ReactNode }) => (
    <div role="dialog">{children}</div>
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
  DialogTitle: ({ children }: { children?: ReactNode }) => (
    <h2>{children}</h2>
  ),
}));

vi.mock("@repo/ui/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@repo/ui/components/ui/label", () => ({
  Label: ({
    children,
    htmlFor,
  }: {
    children?: ReactNode;
    htmlFor?: string;
  }) => <label htmlFor={htmlFor}>{children}</label>,
}));

vi.mock("@repo/ui/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange">) => (
    <button
      aria-checked={checked}
      role="switch"
      type="button"
      {...props}
      onClick={() => onCheckedChange?.(!checked)}
    />
  ),
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/_components/lf-select",
  () => ({
    LfSelect: ({
      "aria-label": ariaLabel,
      onValueChange,
      options,
      value,
    }: {
      "aria-label"?: string;
      onValueChange?: (value: string) => void;
      options: { label: string; value: string }[];
      value?: string;
    }) => (
      <select
        aria-label={ariaLabel}
        onChange={(event) => onValueChange?.(event.currentTarget.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
  })
);

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/developer-connections/_components/developer-connection-detail-sheet",
  () => ({
    DeveloperConnectionDetailSheet: ({
      onOpenChange,
      row,
    }: {
      onOpenChange: (open: boolean) => void;
      row?: { provider: string };
    }) =>
      row ? (
        <div
          data-provider={row.provider}
          data-testid="developer-connection-detail-sheet"
        >
          <button onClick={() => onOpenChange(false)} type="button">
            close-sheet
          </button>
        </div>
      ) : null,
  })
);

const { DeveloperConnectionsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/developer-connections/_components/developer-connections-client"
);
const { default: DeveloperConnectionsPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/developer-connections/page"
);

function baseRow(
  overrides: Partial<DeveloperConnectionRow> = {}
): DeveloperConnectionRow {
  return {
    builder: "Lightfast",
    canManage: true,
    catalogStatus: "available",
    category: "Observability",
    connectAvailability: { status: "available" },
    connection: null,
    description: "Inspect Sentry issues and manage release artifacts.",
    displayName: "Sentry",
    provider: "sentry",
    ...overrides,
  };
}

function connectedSentry(
  overrides: Partial<DeveloperConnectionRow> = {}
): DeveloperConnectionRow {
  return baseRow({
    connection: {
      connectedAt: new Date("2026-06-01T00:00:00.000Z"),
      enabledForSandboxes: true,
      lastUsedAt: null,
      lastUsedByUserId: null,
      lastVerifiedAt: new Date("2026-06-01T00:00:00.000Z"),
      providerAccountName: "lightfast/app",
      status: "connected",
    },
    ...overrides,
  });
}

function availableSentry() {
  return baseRow();
}

function availablePscale() {
  return baseRow({
    category: "Database",
    description: "Provision and inspect PlanetScale development databases.",
    displayName: "PlanetScale",
    provider: "pscale",
  });
}

function renderClient(rows: DeveloperConnectionRow[]) {
  useSuspenseQueryMock.mockReturnValue({ data: rows });
  render(<DeveloperConnectionsClient />);
}

beforeEach(() => {
  vi.clearAllMocks();
  connectionState = null;
  errorState = null;
  Object.keys(capturedMutationOptions).forEach((key) => {
    delete capturedMutationOptions[key];
  });
  fetchQueryMock.mockResolvedValue([]);
  useSuspenseQueryMock.mockReturnValue({ data: [] });
  useMutationMock.mockImplementation(
    (options: { mutationName?: string; onSuccess?: (data?: unknown) => void }) => {
      if (options.mutationName) {
        capturedMutationOptions[options.mutationName] = options;
      }
      const mutate =
        options.mutationName === "connect"
          ? connectMutateMock
          : options.mutationName === "startSentryAuth"
            ? startSentryAuthMutateMock
            : options.mutationName === "completeSentryAuth"
              ? completeSentryAuthMutateMock
              : options.mutationName === "setSandboxEnabled"
                ? setSandboxEnabledMutateMock
                : disconnectMutateMock;
      return {
        isPending: false,
        mutate,
      };
    }
  );
});

describe("DeveloperConnectionsPage", () => {
  it("fetches developer connections before rendering hydrated client UI", async () => {
    fetchQueryMock.mockResolvedValue([connectedSentry()]);
    useSuspenseQueryMock.mockReturnValue({ data: [connectedSentry()] });

    const element = await DeveloperConnectionsPage({
      searchParams: Promise.resolve({ connection: "sentry" }),
    });
    render(element);

    expect(listQueryOptionsMock).toHaveBeenCalled();
    expect(fetchQueryMock).toHaveBeenCalledWith(listQueryOptions);
    expect(
      screen.getByTestId("hydrated-developer-connections")
    ).toHaveTextContent("Developer Connections");
  });

  it("renders connected cards with sandbox toggle and no MCP tool copy", () => {
    renderClient([connectedSentry()]);

    expect(
      screen.getByRole("heading", { name: "Developer Connections" })
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Sentry" })).toBeVisible();
    expect(screen.getByText("Connected", { selector: "span" })).toBeVisible();
    expect(screen.getByText("Use in sandboxes")).toBeVisible();
    expect(screen.queryByText("Tools")).toBeNull();
    expect(screen.queryByText("Use in automations")).toBeNull();
    expect(screen.queryByText("Use in agents")).toBeNull();
  });

  it("renders available provider cards and opens the connect dialog", () => {
    renderClient([availablePscale()]);

    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));

    expect(screen.getByRole("dialog")).toBeVisible();
    expect(screen.getByLabelText(/service token id/i)).toBeVisible();
    expect(screen.getByLabelText(/^service token$/i)).toBeVisible();
  });

  it("submits manual Sentry token credentials", () => {
    renderClient([availableSentry()]);

    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));
    fireEvent.change(screen.getByLabelText(/provider account name/i), {
      target: { value: "lightfast/app" },
    });
    fireEvent.change(screen.getByLabelText(/sentry token/i), {
      target: { value: "sentry-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    expect(connectMutateMock).toHaveBeenCalledWith({
      provider: "sentry",
      providerAccountName: "lightfast/app",
      token: "sentry-token",
    });
  });

  it("starts and completes Sentry browser OAuth from the connect dialog", () => {
    startSentryAuthMutateMock.mockImplementation(() => {
      capturedMutationOptions.startSentryAuth?.onSuccess?.({
        attemptId: "auth_attempt_1",
        expiresAt: new Date("2026-06-03T00:05:00.000Z"),
        userCode: "ABCD-EFGH",
        verificationUri: "https://sentry.io/account/settings/auth-tokens/",
      });
    });
    renderClient([availableSentry()]);

    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));
    fireEvent.change(screen.getByLabelText(/provider account name/i), {
      target: { value: "lightfast/app" },
    });
    fireEvent.click(screen.getByRole("button", { name: /browser oauth/i }));

    expect(startSentryAuthMutateMock).toHaveBeenCalledWith({
      provider: "sentry",
      providerAccountName: "lightfast/app",
    });
    expect(screen.getByText("ABCD-EFGH")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: /complete connection/i }));

    expect(completeSentryAuthMutateMock).toHaveBeenCalledWith({
      provider: "sentry",
      attemptId: "auth_attempt_1",
    });
  });

  it("disables management controls for non-admin members", () => {
    renderClient([
      connectedSentry({
        canManage: false,
        connectAvailability: {
          status: "unavailable",
          reason: "permission_required",
        },
      }),
    ]);

    expect(
      screen.getByRole("switch", { name: /use in sandboxes/i })
    ).toBeDisabled();
    expect(screen.getByText(/admin access required/i)).toBeVisible();
  });
});
