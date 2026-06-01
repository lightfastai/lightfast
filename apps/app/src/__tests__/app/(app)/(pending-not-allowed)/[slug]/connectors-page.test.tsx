import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Provider = "linear" | "slack" | "notion" | "sentry";
type ConnectorRow = {
  availableForAutomations: boolean;
  builder: "Lightfast";
  canManage: boolean;
  catalogStatus: "available" | "coming_soon";
  category: string;
  connectAvailability:
    | { status: "available" }
    | {
        status: "unavailable";
        reason: "coming_soon" | "missing_config" | "permission_required";
        missing?: string[];
      };
  connection: {
    connectedAt: Date;
    enabledForAutomations: boolean;
    lastToolRefreshAt: Date | null;
    lastToolRefreshErrorAt: Date | null;
    lastToolRefreshErrorCode: string | null;
    providerActorName: string | null;
    providerWorkspaceName: string | null;
    status: "active" | "error" | "revoked";
    tools: Array<{
      availableForAutomations: boolean;
      description?: string;
      name: string;
    }>;
  } | null;
  description: string;
  displayName: string;
  provider: Provider;
};

const disconnectMutateMock = vi.fn();
const fetchQueryMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const listQueryFilterMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "connectors", "list"],
}));
const listQueryOptions = {
  queryKey: ["org", "workspace", "connectors", "list"],
};
const listQueryOptionsMock = vi.fn(() => listQueryOptions);
const refreshMutateMock = vi.fn();
const replaceMock = vi.fn();
const setAutomationEnabledMutateMock = vi.fn();
const startConnectMutateMock = vi.fn();
const useMutationMock = vi.fn();
const useSuspenseQueryMock = vi.fn();

let pathname = "/acme/connectors";
let searchParams = new URLSearchParams();
const capturedMutationOptions: Record<
  string,
  { onSuccess?: (data?: unknown) => void }
> = {};

vi.mock("~/trpc/server", () => ({
  getQueryClient: () => ({ fetchQuery: fetchQueryMock }),
  HydrateClient: ({ children }: { children?: ReactNode }) => (
    <div data-testid="hydrated-connectors">{children}</div>
  ),
  trpc: {
    org: {
      workspace: {
        connectors: {
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
        connectors: {
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
          refreshTools: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "refreshTools",
            }),
          },
          setAutomationEnabled: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "setAutomationEnabled",
            }),
          },
          startConnect: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "startConnect",
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

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParams,
}));

vi.mock("@repo/ui/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogAction: ({
    children,
    ...props
  }: {
    children?: ReactNode;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
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
  AlertDialogTrigger: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@repo/ui/components/ui/badge", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
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

vi.mock("@repo/ui/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@repo/ui/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children?: ReactNode;
    onValueChange?: (value: string) => void;
    value?: string;
  }) => (
    <select
      aria-label="Status"
      onChange={(event) => onValueChange?.(event.currentTarget.value)}
      value={value}
    >
      {children}
    </select>
  ),
  SelectContent: ({ children }: { children?: ReactNode }) => <>{children}</>,
  SelectItem: ({
    children,
    value,
  }: {
    children?: ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
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

const { ConnectorsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-client"
);
const { default: ConnectorsPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/page"
);

function row(
  provider: Provider,
  overrides: Partial<ConnectorRow> = {}
): ConnectorRow {
  const names: Record<Provider, string> = {
    linear: "Linear",
    notion: "Notion",
    sentry: "Sentry",
    slack: "Slack",
  };
  return {
    availableForAutomations: false,
    builder: "Lightfast",
    canManage: true,
    catalogStatus: provider === "linear" ? "available" : "coming_soon",
    category: "Project management",
    connectAvailability:
      provider === "linear"
        ? { status: "available" }
        : { status: "unavailable", reason: "coming_soon" },
    connection: null,
    description: `${names[provider]} connector`,
    displayName: names[provider],
    provider,
    ...overrides,
  };
}

function connectedLinear(
  overrides: Partial<NonNullable<ConnectorRow["connection"]>> = {}
): ConnectorRow {
  return row("linear", {
    availableForAutomations: true,
    connection: {
      connectedAt: new Date("2026-06-01T00:00:00.000Z"),
      enabledForAutomations: true,
      lastToolRefreshAt: new Date("2026-06-01T00:00:00.000Z"),
      lastToolRefreshErrorAt: null,
      lastToolRefreshErrorCode: null,
      providerActorName: "Lightfast App",
      providerWorkspaceName: "Acme Linear",
      status: "active",
      tools: [
        {
          availableForAutomations: true,
          description: "Create a Linear issue",
          name: "create_issue",
        },
        {
          availableForAutomations: true,
          description: "Search Linear issues",
          name: "search_issues",
        },
      ],
      ...overrides,
    },
  });
}

const catalogRows = [
  connectedLinear(),
  row("slack", { category: "Communication" }),
  row("notion", { category: "Knowledge" }),
  row("sentry", { category: "Observability" }),
];

function renderClient(rows: ConnectorRow[] = catalogRows) {
  useSuspenseQueryMock.mockReturnValue({ data: rows });
  return render(<ConnectorsClient />);
}

beforeEach(() => {
  disconnectMutateMock.mockReset();
  fetchQueryMock.mockReset();
  invalidateQueriesMock.mockReset();
  listQueryFilterMock.mockClear();
  listQueryOptionsMock.mockClear();
  pathname = "/acme/connectors";
  refreshMutateMock.mockReset();
  replaceMock.mockReset();
  searchParams = new URLSearchParams();
  setAutomationEnabledMutateMock.mockReset();
  startConnectMutateMock.mockReset();
  useMutationMock.mockReset();
  useSuspenseQueryMock.mockReset();
  for (const key of Object.keys(capturedMutationOptions)) {
    delete capturedMutationOptions[key];
  }

  useMutationMock.mockImplementation(
    (options: { mutationName?: string; onSuccess?: () => void }) => {
      if (options.mutationName) {
        capturedMutationOptions[options.mutationName] = options;
      }
      switch (options.mutationName) {
        case "disconnect":
          return { isPending: false, mutate: disconnectMutateMock };
        case "refreshTools":
          return { isPending: false, mutate: refreshMutateMock };
        case "setAutomationEnabled":
          return {
            isPending: false,
            mutate: setAutomationEnabledMutateMock,
          };
        case "startConnect":
          return { isPending: false, mutate: startConnectMutateMock };
        default:
          return { isPending: false, mutate: vi.fn() };
      }
    }
  );
});

describe("connectors page", () => {
  it("fetches the connector list before rendering hydrated client UI", async () => {
    fetchQueryMock.mockResolvedValue(catalogRows);
    useSuspenseQueryMock.mockReturnValue({ data: catalogRows });

    const element = await ConnectorsPage({
      searchParams: Promise.resolve({ connector: "linear" }),
    });
    render(element);

    expect(listQueryOptionsMock).toHaveBeenCalled();
    expect(fetchQueryMock).toHaveBeenCalledWith(listQueryOptions);
    expect(screen.getByTestId("hydrated-connectors")).toHaveTextContent(
      "Connectors"
    );
  });

  it("renders catalog rows and expands connected Linear by default", () => {
    renderClient();

    expect(screen.getByRole("heading", { name: "Connectors" })).toBeVisible();
    expect(
      screen.getByText(
        /allow lightfast to reference other apps through mcp connectors/i
      )
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Linear" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Slack" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Notion" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Sentry" })).toBeVisible();
    expect(screen.getByText("create_issue")).toBeVisible();
    expect(screen.getByText("search_issues")).toBeVisible();
    expect(screen.getByText("Use in automations")).toBeVisible();
  });

  it("disables mutation actions for non-admin rows", () => {
    renderClient(
      [connectedLinear({}), row("slack")].map((item) => ({
        ...item,
        canManage: false,
        connectAvailability: {
          status: "unavailable",
          reason: "permission_required",
        },
      }))
    );

    expect(
      screen.getByRole("button", { name: /refresh tools/i })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /reconnect/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeDisabled();
    expect(
      screen.getByRole("switch", { name: /use in automations/i })
    ).toBeDisabled();
    expect(
      screen.getByText("Admin access required to manage connectors")
    ).toBeVisible();
  });

  it("disables connect when Linear config is missing", () => {
    renderClient([
      row("linear", {
        connectAvailability: {
          status: "unavailable",
          reason: "missing_config",
          missing: ["LINEAR_CLIENT_ID"],
        },
      }),
    ]);

    expect(screen.getByRole("button", { name: /^connect$/i })).toBeDisabled();
    expect(screen.getAllByText(/missing config/i)[0]).toBeVisible();
    expect(screen.getByText(/LINEAR_CLIENT_ID/)).toBeVisible();
  });

  it("renders tools stale and needs reconnect labels", () => {
    const { rerender } = renderClient([
      connectedLinear({
        lastToolRefreshErrorAt: new Date("2026-06-01T00:05:00.000Z"),
        lastToolRefreshErrorCode: "linear_unavailable",
      }),
    ]);
    expect(screen.getByText("Tools stale")).toBeVisible();

    useSuspenseQueryMock.mockReturnValue({
      data: [
        connectedLinear({
          status: "error",
        }),
      ],
    });
    rerender(<ConnectorsClient />);

    expect(screen.getAllByText("Needs reconnect")[1]).toBeVisible();
  });

  it("renders callback errors inline and clears the callback URL", async () => {
    useSuspenseQueryMock.mockReturnValue({ data: catalogRows });

    render(
      <ConnectorsClient
        callbackConnector="linear"
        callbackError="access_denied"
      />
    );

    expect(screen.getByText(/linear connection failed/i)).toBeVisible();
    expect(screen.getByText(/access_denied/i)).toBeVisible();
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/acme/connectors");
    });
  });

  it("clears only callback params and preserves unrelated query params", async () => {
    searchParams = new URLSearchParams(
      "connector=linear&error=access_denied&tab=catalog"
    );
    useSuspenseQueryMock.mockReturnValue({ data: catalogRows });

    render(
      <ConnectorsClient
        callbackConnector="linear"
        callbackError="access_denied"
      />
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/acme/connectors?tab=catalog");
    });
  });

  it("applies search and status filters to the featured Linear row", () => {
    renderClient();

    fireEvent.change(
      screen.getByRole("textbox", { name: /search connectors/i }),
      {
        target: { value: "slack" },
      }
    );

    expect(screen.queryByRole("heading", { name: "Linear" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Slack" })).toBeVisible();

    fireEvent.change(
      screen.getByRole("textbox", { name: /search connectors/i }),
      {
        target: { value: "" },
      }
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
      target: { value: "coming_soon" },
    });

    expect(screen.queryByRole("heading", { name: "Linear" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Slack" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Notion" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Sentry" })).toBeVisible();
  });

  it("redirects same-tab after startConnect succeeds", () => {
    useSuspenseQueryMock.mockReturnValue({ data: [row("linear")] });

    render(<ConnectorsClient />);
    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));

    expect(startConnectMutateMock).toHaveBeenCalledWith({ provider: "linear" });

    capturedMutationOptions.startConnect?.onSuccess?.({
      authorizationUrl: "https://linear.example/oauth",
      mode: "connect",
    });

    expect(window.location.href).toBe("https://linear.example/oauth");
  });

  it("calls refresh, toggle, and disconnect mutations and invalidates after refresh", () => {
    useSuspenseQueryMock.mockReturnValue({ data: [connectedLinear()] });

    render(<ConnectorsClient />);

    fireEvent.click(screen.getByRole("button", { name: /refresh tools/i }));
    expect(refreshMutateMock).toHaveBeenCalledWith({ provider: "linear" });
    capturedMutationOptions.refreshTools?.onSuccess?.();
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["org", "workspace", "connectors", "list"],
    });

    fireEvent.click(
      screen.getByRole("switch", { name: /use in automations/i })
    );
    expect(setAutomationEnabledMutateMock).toHaveBeenCalledWith({
      enabled: false,
      provider: "linear",
    });

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(disconnectMutateMock).toHaveBeenCalledWith({ provider: "linear" });
  });
});
