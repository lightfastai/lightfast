import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutateMock = vi.fn();
const pushMock = vi.fn();
let connectorRows: ConnectorRow[];

interface ConnectorRow {
  availableForAutomations: boolean;
  connection: { enabledForAutomations: boolean } | null;
  displayName: string;
  provider: "linear" | "x";
}

function connectorRow(
  provider: "linear" | "x",
  enabledForAutomations: boolean
): ConnectorRow {
  return {
    availableForAutomations: enabledForAutomations,
    connection: { enabledForAutomations },
    displayName: provider === "linear" ? "Linear" : "X",
    provider,
  };
}

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        automations: {
          create: { mutationOptions: (options: unknown) => options },
          get: {
            queryOptions: ({ id }: { id: string }) => ({
              queryKey: ["automations", "get", id],
            }),
          },
          list: {
            queryOptions: () => ({
              queryKey: ["automations", "list"],
            }),
          },
        },
        connectors: {
          list: {
            queryOptions: () => ({
              queryKey: ["connectors", "list"],
            }),
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isPending: false, mutate: mutateMock }),
  useQueryClient: () => ({
    setQueryData: vi.fn(),
  }),
  useSuspenseQuery: () => ({ data: connectorRows }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@repo/ui/components/ui/sonner", () => ({
  toast: { success: vi.fn() },
}));

vi.mock("@repo/ui/components/ui/badge", () => ({
  Badge: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
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
      options: readonly { label: string; value: string }[];
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

const { AutomationCreateForm } = await import("./automation-create-form");

beforeEach(() => {
  mutateMock.mockReset();
  pushMock.mockReset();
  connectorRows = [connectorRow("linear", true), connectorRow("x", true)];
});

describe("AutomationCreateForm", () => {
  it("submits no connector by default", async () => {
    render(<AutomationCreateForm slug="acme" />);

    expect(
      screen.getByRole("combobox", { name: "Connector" })
    ).toHaveDisplayValue("No connector");

    fireEvent.change(screen.getByPlaceholderText("Daily code review"), {
      target: { value: "Daily digest" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(
        "Describe what the agent should do in each run."
      ),
      {
        target: { value: "Summarize posts from the workspace." },
      }
    );

    fireEvent.submit(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(mutateMock).toHaveBeenCalledWith({
        connectorProvider: null,
        name: "Daily digest",
        prompt: "Summarize posts from the workspace.",
        schedule: { kind: "daily", config: { time: "09:00" } },
        timezone: "UTC",
      })
    );
  });

  it("submits the selected enabled connector provider with the new automation", async () => {
    render(<AutomationCreateForm slug="acme" />);

    fireEvent.change(screen.getByPlaceholderText("Daily code review"), {
      target: { value: "X daily digest" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(
        "Describe what the agent should do in each run."
      ),
      {
        target: { value: "Summarize posts from the workspace." },
      }
    );
    fireEvent.change(screen.getByRole("combobox", { name: "Connector" }), {
      target: { value: "x" },
    });

    fireEvent.submit(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(mutateMock).toHaveBeenCalledWith({
        connectorProvider: "x",
        name: "X daily digest",
        prompt: "Summarize posts from the workspace.",
        schedule: { kind: "daily", config: { time: "09:00" } },
        timezone: "UTC",
      })
    );
  });

  it("excludes connectors disabled for automations from the selector", () => {
    connectorRows = [connectorRow("linear", false), connectorRow("x", false)];

    render(<AutomationCreateForm slug="acme" />);

    const connectorSelect = screen.getByRole("combobox", {
      name: "Connector",
    });

    expect(connectorSelect).toHaveDisplayValue("No connector");
    expect(screen.queryByRole("option", { name: "Linear" })).toBeNull();
    expect(screen.queryByRole("option", { name: "X" })).toBeNull();
  });
});
