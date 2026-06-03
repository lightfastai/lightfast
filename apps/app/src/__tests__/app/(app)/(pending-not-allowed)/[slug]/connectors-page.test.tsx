import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface ConnectorRow {
  availableForAutomations: boolean;
  builder: "Lightfast";
  canManage: boolean;
  catalogStatus: "available";
  category: string;
  connectAvailability:
    | { status: "available" }
    | {
        status: "unavailable";
        reason: "missing_config" | "permission_required";
        missing?: string[];
      };
  connection: {
    connectedAt: Date;
    enabledForAgents: boolean;
    enabledForAutomations: boolean;
    lastToolRefreshAt: Date | null;
    lastToolRefreshErrorAt: Date | null;
    lastToolRefreshErrorCode: string | null;
    providerActorName: string | null;
    providerWorkspaceName: string | null;
    status: "active" | "error" | "revoked";
    tools: Array<{
      availableForAgents: boolean;
      availableForAutomations: boolean;
      description?: string;
      name: string;
    }>;
  } | null;
  description: string;
  displayName: string;
  provider: "linear" | "x";
}

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
const setAgentEnabledMutateMock = vi.fn();
const setAutomationEnabledMutateMock = vi.fn();
const startConnectMutateMock = vi.fn();
const useMutationMock = vi.fn();
const useSuspenseQueryMock = vi.fn();

let connectorState: string | null = null;
let errorState: string | null = null;
const setConnectorMock = vi.fn((value: string | null) => {
  connectorState = value;
});
const setErrorMock = vi.fn((value: string | null) => {
  errorState = value;
});

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
          setAgentEnabled: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "setAgentEnabled",
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

vi.mock("nuqs", () => ({
  useQueryState: (key: string) => {
    if (key === "error") {
      return [errorState, setErrorMock];
    }
    return [connectorState, setConnectorMock];
  },
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connector-detail-sheet",
  () => ({
    ConnectorDetailSheet: ({
      onOpenChange,
      row,
    }: {
      onOpenChange: (open: boolean) => void;
      row?: { provider: string };
    }) =>
      row ? (
        <div data-provider={row.provider} data-testid="connector-detail-sheet">
          <button onClick={() => onOpenChange(false)} type="button">
            close-sheet
          </button>
        </div>
      ) : null,
  })
);

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
    disabled,
    onSelect,
    variant: _variant,
    ...props
  }: {
    children?: ReactNode;
    disabled?: boolean;
    onSelect?: (event: { preventDefault: () => void }) => void;
    variant?: string;
  }) => (
    <button
      disabled={disabled}
      onClick={(event) => onSelect?.(event)}
      type="button"
      {...props}
    >
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@repo/ui/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
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

vi.mock("@repo/ui/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children?: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

const { ConnectorsClient } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/_components/connectors-client"
);
const { default: ConnectorsPage } = await import(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/connectors/page"
);

function row(overrides: Partial<ConnectorRow> = {}): ConnectorRow {
  return {
    availableForAutomations: false,
    builder: "Lightfast",
    canManage: true,
    catalogStatus: "available",
    category: "Project management",
    connectAvailability: { status: "available" },
    connection: null,
    description: "Find, create, and manage issues, projects in Linear.",
    displayName: "Linear",
    provider: "linear",
    ...overrides,
  };
}

function connectedLinear(
  overrides: Partial<NonNullable<ConnectorRow["connection"]>> = {}
): ConnectorRow {
  return row({
    availableForAutomations: true,
    connection: {
      connectedAt: new Date("2026-06-01T00:00:00.000Z"),
      enabledForAgents: false,
      enabledForAutomations: true,
      lastToolRefreshAt: new Date("2026-06-01T00:00:00.000Z"),
      lastToolRefreshErrorAt: null,
      lastToolRefreshErrorCode: null,
      providerActorName: "Lightfast App",
      providerWorkspaceName: "Acme Linear",
      status: "active",
      tools: [
        {
          availableForAgents: false,
          availableForAutomations: true,
          description: "Create a Linear issue",
          name: "create_issue",
        },
        {
          availableForAgents: false,
          availableForAutomations: true,
          description: "Search Linear issues",
          name: "search_issues",
        },
      ],
      ...overrides,
    },
  });
}

function xRow(overrides: Partial<ConnectorRow> = {}): ConnectorRow {
  return row({
    category: "Social",
    description: "Search posts and look up X accounts from Lightfast.",
    displayName: "X",
    provider: "x",
    ...overrides,
  });
}

function connectedX(
  overrides: Partial<NonNullable<ConnectorRow["connection"]>> = {}
): ConnectorRow {
  return xRow({
    availableForAutomations: true,
    connection: {
      connectedAt: new Date("2026-06-01T00:00:00.000Z"),
      enabledForAgents: true,
      enabledForAutomations: true,
      lastToolRefreshAt: new Date("2026-06-01T00:00:00.000Z"),
      lastToolRefreshErrorAt: null,
      lastToolRefreshErrorCode: null,
      providerActorName: "@lightfast",
      providerWorkspaceName: "X",
      status: "active",
      tools: [
        {
          availableForAutomations: true,
          availableForAgents: true,
          description: "Look up account",
          name: "getUsersByUsername",
        },
      ],
      ...overrides,
    },
  });
}

function renderClient(rows: ConnectorRow[] = [connectedLinear()]) {
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
  setAgentEnabledMutateMock.mockReset();
  setAutomationEnabledMutateMock.mockReset();
  startConnectMutateMock.mockReset();
  useMutationMock.mockReset();
  useSuspenseQueryMock.mockReset();
  connectorState = null;
  errorState = null;
  setConnectorMock.mockClear();
  setErrorMock.mockClear();
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
        case "setAgentEnabled":
          return {
            isPending: false,
            mutate: setAgentEnabledMutateMock,
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
    fetchQueryMock.mockResolvedValue([connectedLinear()]);
    useSuspenseQueryMock.mockReturnValue({ data: [connectedLinear()] });

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

  it("renders the connected Linear card with tools, automation, and agent toggles", () => {
    renderClient();

    expect(screen.getByRole("heading", { name: "Connectors" })).toBeVisible();
    expect(
      screen.getByText(
        /allow lightfast to reference other apps for more context and actions through mcp connectors/i
      )
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Linear" })).toBeVisible();
    expect(screen.getByText("Connected", { selector: "span" })).toBeVisible();
    expect(screen.getByText("Tools")).toBeVisible();
    expect(screen.getByText("create_issue")).toBeVisible();
    expect(screen.getByText("search_issues")).toBeVisible();
    expect(screen.getByText("Use in automations")).toBeVisible();
    expect(screen.getByText("Use in agents")).toBeVisible();
  });

  it("renders the connect card for an available Linear connector", () => {
    renderClient([row()]);

    expect(screen.getByRole("heading", { name: "Linear" })).toBeVisible();
    expect(screen.getByRole("button", { name: /^connect$/i })).toBeVisible();
    expect(screen.queryByText("Use in automations")).toBeNull();
    expect(screen.queryByText("Use in agents")).toBeNull();
  });

  it("renders the X connector card", () => {
    renderClient([xRow()]);

    expect(screen.getByRole("heading", { name: "X" })).toBeVisible();
    expect(
      screen.getByText(/search posts and look up x accounts/i)
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /^connect$/i })).toBeVisible();
  });

  it("filters connectors by search query", () => {
    renderClient();

    fireEvent.change(
      screen.getByRole("textbox", { name: /search connectors/i }),
      { target: { value: "linear" } }
    );
    expect(screen.getByRole("heading", { name: "Linear" })).toBeVisible();

    fireEvent.change(
      screen.getByRole("textbox", { name: /search connectors/i }),
      { target: { value: "asana" } }
    );
    expect(screen.queryByRole("heading", { name: "Linear" })).toBeNull();
    expect(
      screen.getByText(/no connectors match these filters/i)
    ).toBeVisible();
  });

  it("filters connectors by status", () => {
    renderClient();

    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
      target: { value: "connected" },
    });
    expect(screen.getByRole("heading", { name: "Linear" })).toBeVisible();

    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
      target: { value: "available" },
    });
    expect(screen.queryByRole("heading", { name: "Linear" })).toBeNull();
  });

  it("disables connect when Linear config is missing", () => {
    renderClient([
      row({
        connectAvailability: {
          status: "unavailable",
          reason: "missing_config",
          missing: ["LINEAR_CLIENT_ID"],
        },
      }),
    ]);

    expect(screen.getByRole("button", { name: /^connect$/i })).toBeDisabled();
    expect(screen.getByText(/missing config/i)).toBeVisible();
    expect(screen.getByText(/LINEAR_CLIENT_ID/)).toBeVisible();
  });

  it("uses provider-aware missing config copy for X", () => {
    renderClient([
      xRow({
        connectAvailability: {
          status: "unavailable",
          reason: "missing_config",
          missing: ["X_CLIENT_ID"],
        },
      }),
    ]);

    expect(screen.getByRole("button", { name: /^connect$/i })).toBeDisabled();
    expect(
      screen.getByText("X OAuth credentials are not configured.")
    ).toBeVisible();
    expect(screen.getByText(/X_CLIENT_ID/)).toBeVisible();
  });

  it("disables overflow actions and toggle for non-admin members", () => {
    renderClient([
      {
        ...connectedLinear(),
        canManage: false,
        connectAvailability: {
          status: "unavailable",
          reason: "permission_required",
        },
      },
    ]);

    expect(
      screen.getByRole("button", { name: /refresh tools/i })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: /reconnect/i })).toBeDisabled();
    // Disconnect is fake-disabled (aria-disabled, not the native attribute) so
    // its tooltip still shows on hover.
    expect(screen.getByRole("button", { name: /disconnect/i })).toHaveAttribute(
      "aria-disabled",
      "true"
    );
    expect(
      screen.getByRole("switch", { name: /use in automations/i })
    ).toBeDisabled();
    expect(
      screen.getByRole("switch", { name: /use in agents/i })
    ).toBeDisabled();
    expect(
      screen.getByText("Disconnecting isn't available right now.")
    ).toBeVisible();
    expect(
      screen.getByText("Admin access required to manage connectors")
    ).toBeVisible();
  });

  it("renders tools stale and needs reconnect status labels", () => {
    const { rerender } = renderClient([
      connectedLinear({
        lastToolRefreshErrorAt: new Date("2026-06-01T00:05:00.000Z"),
        lastToolRefreshErrorCode: "linear_unavailable",
      }),
    ]);
    expect(screen.getByText("Tools stale")).toBeVisible();

    useSuspenseQueryMock.mockReturnValue({
      data: [connectedLinear({ status: "error" })],
    });
    rerender(<ConnectorsClient />);

    expect(
      screen.getByText("Needs reconnect", { selector: "span" })
    ).toBeVisible();
  });

  it("renders callback errors inline and clears the callback params", async () => {
    connectorState = "linear";
    errorState = "access_denied";
    useSuspenseQueryMock.mockReturnValue({ data: [connectedLinear()] });

    render(
      <ConnectorsClient
        callbackConnector="linear"
        callbackError="access_denied"
      />
    );

    expect(screen.getByText(/linear connection failed/i)).toBeVisible();
    expect(screen.getByText(/access_denied/i)).toBeVisible();
    await waitFor(() => {
      expect(setConnectorMock).toHaveBeenCalledWith(null);
      expect(setErrorMock).toHaveBeenCalledWith(null);
    });
  });

  it("does not open the detail sheet when a callback error is present", () => {
    connectorState = "linear";
    errorState = "access_denied";
    useSuspenseQueryMock.mockReturnValue({ data: [connectedLinear()] });

    render(
      <ConnectorsClient
        callbackConnector="linear"
        callbackError="access_denied"
      />
    );

    expect(screen.queryByTestId("connector-detail-sheet")).toBeNull();
  });

  it("redirects same-tab after startConnect succeeds", () => {
    useSuspenseQueryMock.mockReturnValue({ data: [row()] });

    render(<ConnectorsClient />);
    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));

    expect(startConnectMutateMock).toHaveBeenCalledWith({ provider: "linear" });

    capturedMutationOptions.startConnect?.onSuccess?.({
      authorizationUrl: "https://linear.example/oauth",
      mode: "connect",
    });

    expect(window.location.href).toBe("https://linear.example/oauth");
  });

  it("starts X connect with provider x", () => {
    useSuspenseQueryMock.mockReturnValue({ data: [xRow()] });

    render(<ConnectorsClient />);
    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));

    expect(startConnectMutateMock).toHaveBeenCalledWith({ provider: "x" });
  });

  it("calls refresh, toggle, and disconnect mutations from the connected card", () => {
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

    fireEvent.click(screen.getByRole("switch", { name: /use in agents/i }));
    expect(setAgentEnabledMutateMock).toHaveBeenCalledWith({
      enabled: true,
      provider: "linear",
    });

    fireEvent.click(screen.getByRole("button", { name: /disconnect/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    expect(disconnectMutateMock).toHaveBeenCalledWith({ provider: "linear" });
  });

  it("opens the detail sheet from the View details action", () => {
    renderClient([connectedLinear()]);

    fireEvent.click(screen.getByRole("button", { name: /view details/i }));
    expect(setConnectorMock).toHaveBeenCalledWith("linear");
  });

  it("opens the detail sheet for the connector in the URL param", () => {
    connectorState = "linear";
    renderClient([connectedLinear()]);

    const sheet = screen.getByTestId("connector-detail-sheet");
    expect(sheet).toBeVisible();
    expect(sheet).toHaveAttribute("data-provider", "linear");
  });

  it("opens the detail sheet for X in the URL param", () => {
    connectorState = "x";
    renderClient([connectedX()]);

    const sheet = screen.getByTestId("connector-detail-sheet");
    expect(sheet).toBeVisible();
    expect(sheet).toHaveAttribute("data-provider", "x");
  });

  it("does not open the detail sheet for an unconnected provider", () => {
    connectorState = "linear";
    renderClient([row()]);

    expect(screen.queryByTestId("connector-detail-sheet")).toBeNull();
  });

  it("clears the connector param when the sheet is closed", () => {
    connectorState = "linear";
    renderClient([connectedLinear()]);

    fireEvent.click(screen.getByRole("button", { name: "close-sheet" }));
    expect(setConnectorMock).toHaveBeenCalledWith(null);
  });
});
