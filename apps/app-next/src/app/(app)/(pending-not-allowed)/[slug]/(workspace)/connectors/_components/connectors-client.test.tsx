import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

interface TeamConnectorRow {
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
  ownerType?: "org";
  provider: "linear" | "x";
}

interface UserConnectorRow {
  builder: "Granola";
  canManage: boolean;
  catalogStatus: "available";
  category: string;
  connectAvailability: { status: "available" };
  connection: {
    availableForInteractiveChats: boolean;
    connectedAt: Date;
    lastToolRefreshAt: Date | null;
    lastToolRefreshErrorAt: Date | null;
    lastToolRefreshErrorCode: string | null;
    providerAccountName: string | null;
    status: "active" | "error" | "revoked";
    tools: Array<{
      availableForInteractiveChats: boolean;
      description?: string;
      name: string;
    }>;
  } | null;
  description: string;
  displayName: string;
  ownerType: "user";
  provider: "granola";
}

interface ConnectorSections {
  teamConnectors: TeamConnectorRow[];
  yourConnectors: UserConnectorRow[];
}

const disconnectMutateMock = vi.fn();
const invalidateQueriesMock = vi.fn();
const listQueryFilterMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "connectors", "list"],
}));
const listQueryOptions = {
  queryKey: ["org", "workspace", "connectors", "list"],
};
const listQueryOptionsMock = vi.fn(() => listQueryOptions);
const listSectionsQueryFilterMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "connectors", "listSections"],
}));
const listSectionsQueryOptionsMock = vi.fn(() => ({
  queryKey: ["org", "workspace", "connectors", "listSections"],
}));
const refreshMutateMock = vi.fn();
const setAgentEnabledMutateMock = vi.fn();
const setAutomationEnabledMutateMock = vi.fn();
const startConnectMutateMock = vi.fn();
const userDisconnectMutateMock = vi.fn();
const userStartConnectMutateMock = vi.fn();
const useMutationMock = vi.fn();
const useSuspenseQueryMock = vi.fn();

let connectorState: string | null = null;
let errorState: string | null = null;
let ownerScopeState: "team" | "personal" = "team";
const setConnectorMock = vi.fn((value: string | null) => {
  connectorState = value;
});
const setErrorMock = vi.fn((value: string | null) => {
  errorState = value;
});
const setOwnerScopeMock = vi.fn((value: "team" | "personal") => {
  ownerScopeState = value;
});

const capturedMutationOptions: Record<
  string,
  { onSuccess?: (data?: unknown) => void }
> = {};

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
          listSections: {
            queryFilter: listSectionsQueryFilterMock,
            queryOptions: listSectionsQueryOptionsMock,
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
    viewer: {
      account: {
        userConnectors: {
          disconnect: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "userDisconnect",
            }),
          },
          startConnect: {
            mutationOptions: (options: unknown) => ({
              ...(options as object),
              mutationName: "userStartConnect",
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
  parseAsStringLiteral: () => ({ withDefault: () => "mock-parser" }),
  useQueryState: (key: string) => {
    if (key === "error") {
      return [errorState, setErrorMock];
    }
    if (key === "scope") {
      return [ownerScopeState, setOwnerScopeMock];
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

function row(overrides: Partial<TeamConnectorRow> = {}): TeamConnectorRow {
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
  overrides: Partial<NonNullable<TeamConnectorRow["connection"]>> = {}
): TeamConnectorRow {
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

function xRow(overrides: Partial<TeamConnectorRow> = {}): TeamConnectorRow {
  return row({
    category: "Social",
    description: "Search posts and look up X accounts from Lightfast.",
    displayName: "X",
    provider: "x",
    ...overrides,
  });
}

function connectedX(
  overrides: Partial<NonNullable<TeamConnectorRow["connection"]>> = {}
): TeamConnectorRow {
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

function granolaRow(
  overrides: Partial<UserConnectorRow> = {}
): UserConnectorRow {
  return {
    builder: "Granola",
    canManage: true,
    catalogStatus: "available",
    category: "Meeting notes",
    connectAvailability: { status: "available" },
    connection: null,
    description:
      "Search and reference your private Granola meeting notes in Lightfast chats.",
    displayName: "Granola",
    ownerType: "user",
    provider: "granola",
    ...overrides,
  };
}

function connectedGranola(
  overrides: Partial<NonNullable<UserConnectorRow["connection"]>> = {}
): UserConnectorRow {
  return granolaRow({
    connection: {
      availableForInteractiveChats: true,
      connectedAt: new Date("2026-06-01T00:00:00.000Z"),
      lastToolRefreshAt: new Date("2026-06-01T00:00:00.000Z"),
      lastToolRefreshErrorAt: null,
      lastToolRefreshErrorCode: null,
      providerAccountName: "jeevan@example.com",
      status: "active",
      tools: [
        {
          availableForInteractiveChats: true,
          description: "Search private meeting notes",
          name: "search_notes",
        },
      ],
      ...overrides,
    },
  });
}

function sections(
  overrides: Partial<ConnectorSections> = {}
): ConnectorSections {
  return {
    teamConnectors: [connectedLinear()],
    yourConnectors: [],
    ...overrides,
  };
}

function renderClient(data: ConnectorSections = sections()) {
  useSuspenseQueryMock.mockReturnValue({ data });
  return render(<ConnectorsClient />);
}

beforeEach(() => {
  disconnectMutateMock.mockReset();
  invalidateQueriesMock.mockReset();
  listQueryFilterMock.mockClear();
  listQueryOptionsMock.mockClear();
  listSectionsQueryFilterMock.mockClear();
  listSectionsQueryOptionsMock.mockClear();
  refreshMutateMock.mockReset();
  setAgentEnabledMutateMock.mockReset();
  setAutomationEnabledMutateMock.mockReset();
  startConnectMutateMock.mockReset();
  userDisconnectMutateMock.mockReset();
  userStartConnectMutateMock.mockReset();
  useMutationMock.mockReset();
  useSuspenseQueryMock.mockReset();
  connectorState = null;
  errorState = null;
  ownerScopeState = "team";
  setConnectorMock.mockClear();
  setErrorMock.mockClear();
  setOwnerScopeMock.mockClear();
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
        case "userDisconnect":
          return { isPending: false, mutate: userDisconnectMutateMock };
        case "userStartConnect":
          return { isPending: false, mutate: userStartConnectMutateMock };
        default:
          return { isPending: false, mutate: vi.fn() };
      }
    }
  );
});

describe("ConnectorsClient", () => {
  it("renders the team section by default without an in-page ownership switcher", () => {
    renderClient(
      sections({
        teamConnectors: [connectedLinear()],
        yourConnectors: [granolaRow()],
      })
    );

    expect(
      screen.queryByRole("tablist", { name: /connector ownership/i })
    ).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Team connectors" })
    ).toBeVisible();
    expect(
      screen.getByText("Team", { selector: "[data-slot='badge']" })
    ).toBeVisible();
    expect(screen.queryByText("Only you")).toBeNull();
  });

  it("renders the personal section from the shared ownership scope param", () => {
    ownerScopeState = "personal";
    renderClient(
      sections({
        teamConnectors: [connectedLinear()],
        yourConnectors: [granolaRow()],
      })
    );

    expect(
      screen.getByRole("heading", { name: "Personal connectors" })
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Linear" })).toBeNull();
    expect(
      screen.queryByText("Team", { selector: "[data-slot='badge']" })
    ).toBeNull();
    expect(screen.getByText("Only you")).toBeVisible();
  });

  it("renders user connector cards as private chat-only connectors", () => {
    ownerScopeState = "personal";
    const { container } = renderClient(
      sections({
        teamConnectors: [connectedLinear()],
        yourConnectors: [connectedGranola()],
      })
    );

    const userCard = container.querySelector('[data-owner="user"]');
    expect(userCard).not.toBeNull();
    const userScope = within(userCard as HTMLElement);

    expect(userScope.getByRole("heading", { name: "Granola" })).toBeVisible();
    expect(userScope.getByText("Only you")).toBeVisible();
    expect(
      userScope.getByText("Available in your chats. Not visible to teammates.")
    ).toBeVisible();
    expect(userScope.getByText("search_notes")).toBeVisible();
    expect(userScope.queryByText("Use in automations")).toBeNull();
    expect(userScope.queryByText("Use in agents")).toBeNull();
    expect(
      userScope.queryByText("Admin access required to manage connectors")
    ).toBeNull();
  });

  it("shows a user connector empty tools state instead of a blank tool row", () => {
    ownerScopeState = "personal";
    const { container } = renderClient(
      sections({
        teamConnectors: [],
        yourConnectors: [connectedGranola({ tools: [] })],
      })
    );

    const userCard = container.querySelector('[data-owner="user"]');
    expect(userCard).not.toBeNull();
    expect(
      within(userCard as HTMLElement).getByText("No tools available yet.")
    ).toBeVisible();
  });

  it("filters the active ownership view independently", () => {
    const { rerender } = renderClient(
      sections({
        teamConnectors: [connectedLinear()],
        yourConnectors: [connectedGranola()],
      })
    );

    fireEvent.change(
      screen.getByRole("textbox", { name: /search connectors/i }),
      { target: { value: "granola" } }
    );

    expect(
      screen.getByRole("heading", { name: "Team connectors" })
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Linear" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Granola" })).toBeNull();
    expect(
      screen.getByText(/no connectors match these filters/i)
    ).toBeVisible();

    ownerScopeState = "personal";
    useSuspenseQueryMock.mockReturnValue({
      data: sections({
        teamConnectors: [connectedLinear()],
        yourConnectors: [connectedGranola()],
      }),
    });
    rerender(<ConnectorsClient />);

    expect(
      screen.getByRole("heading", { name: "Personal connectors" })
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Granola" })).toBeVisible();
  });

  it("switches the shared scope to personal for a Granola callback", async () => {
    useSuspenseQueryMock.mockReturnValue({
      data: sections({
        teamConnectors: [connectedLinear()],
        yourConnectors: [connectedGranola()],
      }),
    });

    render(
      <ConnectorsClient callbackConnector="granola" callbackError={undefined} />
    );

    await waitFor(() => {
      expect(setOwnerScopeMock).toHaveBeenCalledWith("personal");
    });
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
    renderClient(sections({ teamConnectors: [row()] }));

    expect(screen.getByRole("heading", { name: "Linear" })).toBeVisible();
    expect(screen.getByRole("button", { name: /^connect$/i })).toBeVisible();
    expect(screen.queryByText("Use in automations")).toBeNull();
    expect(screen.queryByText("Use in agents")).toBeNull();
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

  it("uses provider-aware missing config copy for X", () => {
    renderClient(
      sections({
        teamConnectors: [
          xRow({
            connectAvailability: {
              status: "unavailable",
              reason: "missing_config",
              missing: ["X_CLIENT_ID"],
            },
          }),
        ],
      })
    );

    expect(screen.getByRole("button", { name: /^connect$/i })).toBeDisabled();
    expect(
      screen.getByText("X OAuth credentials are not configured.")
    ).toBeVisible();
    expect(screen.getByText(/X_CLIENT_ID/)).toBeVisible();
  });

  it("disables overflow actions and toggle for non-admin members", () => {
    renderClient(
      sections({
        teamConnectors: [
          {
            ...connectedLinear(),
            canManage: false,
            connectAvailability: {
              status: "unavailable",
              reason: "permission_required",
            },
          },
        ],
      })
    );

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
    const { rerender } = renderClient(
      sections({
        teamConnectors: [
          connectedLinear({
            lastToolRefreshErrorAt: new Date("2026-06-01T00:05:00.000Z"),
            lastToolRefreshErrorCode: "linear_unavailable",
          }),
        ],
      })
    );
    expect(screen.getByText("Tools stale")).toBeVisible();

    useSuspenseQueryMock.mockReturnValue({
      data: sections({
        teamConnectors: [connectedLinear({ status: "error" })],
      }),
    });
    rerender(<ConnectorsClient />);

    expect(
      screen.getByText("Needs reconnect", { selector: "span" })
    ).toBeVisible();
  });

  it("renders callback errors inline and clears the callback params", async () => {
    connectorState = "linear";
    errorState = "access_denied";
    useSuspenseQueryMock.mockReturnValue({ data: sections() });

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
    useSuspenseQueryMock.mockReturnValue({ data: sections() });

    render(
      <ConnectorsClient
        callbackConnector="linear"
        callbackError="access_denied"
      />
    );

    expect(screen.queryByTestId("connector-detail-sheet")).toBeNull();
  });

  it("redirects same-tab after startConnect succeeds", () => {
    useSuspenseQueryMock.mockReturnValue({
      data: sections({ teamConnectors: [row()] }),
    });

    render(<ConnectorsClient />);
    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));

    expect(startConnectMutateMock).toHaveBeenCalledWith({ provider: "linear" });

    capturedMutationOptions.startConnect?.onSuccess?.({
      authorizationUrl: "https://linear.example/oauth",
      mode: "connect",
    });

    expect(window.location.href).toBe("https://linear.example/oauth");
  });

  it("starts user connector connect through the viewer account mutation", () => {
    ownerScopeState = "personal";
    const { container } = renderClient(
      sections({ teamConnectors: [], yourConnectors: [granolaRow()] })
    );
    const userCard = container.querySelector('[data-owner="user"]');
    expect(userCard).not.toBeNull();

    fireEvent.click(
      within(userCard as HTMLElement).getByRole("button", {
        name: /^connect$/i,
      })
    );

    expect(userStartConnectMutateMock).toHaveBeenCalledWith({
      provider: "granola",
    });
    expect(startConnectMutateMock).not.toHaveBeenCalled();

    capturedMutationOptions.userStartConnect?.onSuccess?.({
      authorizationUrl: "https://granola.example/oauth",
      mode: "connect",
    });

    expect(window.location.href).toBe("https://granola.example/oauth");
  });

  it("disconnects user connectors through the viewer account mutation", () => {
    ownerScopeState = "personal";
    const { container } = renderClient(
      sections({
        teamConnectors: [],
        yourConnectors: [connectedGranola()],
      })
    );
    const userCard = container.querySelector('[data-owner="user"]');
    expect(userCard).not.toBeNull();

    fireEvent.click(
      within(userCard as HTMLElement).getByRole("button", {
        name: /disconnect/i,
      })
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

    expect(userDisconnectMutateMock).toHaveBeenCalledWith({
      provider: "granola",
    });
    expect(disconnectMutateMock).not.toHaveBeenCalled();

    capturedMutationOptions.userDisconnect?.onSuccess?.();
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["org", "workspace", "connectors", "listSections"],
    });
  });

  it("calls refresh, toggle, and disconnect mutations from the connected card", () => {
    useSuspenseQueryMock.mockReturnValue({ data: sections() });

    render(<ConnectorsClient />);

    fireEvent.click(screen.getByRole("button", { name: /refresh tools/i }));
    expect(refreshMutateMock).toHaveBeenCalledWith({ provider: "linear" });
    capturedMutationOptions.refreshTools?.onSuccess?.();
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ["org", "workspace", "connectors", "listSections"],
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
    renderClient(sections({ teamConnectors: [connectedLinear()] }));

    fireEvent.click(screen.getByRole("button", { name: /view details/i }));
    expect(setConnectorMock).toHaveBeenCalledWith("linear");
  });

  it("opens the detail sheet for the connector in the URL param", () => {
    connectorState = "linear";
    renderClient(sections({ teamConnectors: [connectedLinear()] }));

    const sheet = screen.getByTestId("connector-detail-sheet");
    expect(sheet).toBeVisible();
    expect(sheet).toHaveAttribute("data-provider", "linear");
  });

  it("opens the detail sheet for X in the URL param", () => {
    connectorState = "x";
    renderClient(sections({ teamConnectors: [connectedX()] }));

    const sheet = screen.getByTestId("connector-detail-sheet");
    expect(sheet).toBeVisible();
    expect(sheet).toHaveAttribute("data-provider", "x");
  });

  it("opens the detail sheet for a user connector in the URL param", () => {
    connectorState = "granola";
    renderClient(
      sections({
        teamConnectors: [],
        yourConnectors: [connectedGranola()],
      })
    );

    const sheet = screen.getByTestId("connector-detail-sheet");
    expect(sheet).toBeVisible();
    expect(sheet).toHaveAttribute("data-provider", "granola");
  });

  it("does not open the detail sheet for an unconnected provider", () => {
    connectorState = "linear";
    renderClient(sections({ teamConnectors: [row()] }));

    expect(screen.queryByTestId("connector-detail-sheet")).toBeNull();
  });

  it("clears the connector param when the sheet is closed", () => {
    connectorState = "linear";
    renderClient(sections({ teamConnectors: [connectedLinear()] }));

    fireEvent.click(screen.getByRole("button", { name: "close-sheet" }));
    expect(setConnectorMock).toHaveBeenCalledWith(null);
  });
});
