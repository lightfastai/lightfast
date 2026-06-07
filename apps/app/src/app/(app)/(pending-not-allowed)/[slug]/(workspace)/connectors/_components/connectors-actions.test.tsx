import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setScopeMock = vi.fn();
const useSuspenseQueryMock = vi.fn();

let connectorState: string | null = null;
let scopeState: "team" | "personal" = "team";

vi.mock("nuqs", () => ({
  parseAsStringLiteral: () => ({ withDefault: () => "mock-parser" }),
  useQueryState: (key: string) =>
    key === "connector"
      ? ([connectorState, vi.fn()] as const)
      : ([scopeState, setScopeMock] as const),
}));

vi.mock("~/trpc/react", () => ({
  useTRPC: () => ({
    org: {
      workspace: {
        connectors: {
          listSections: {
            queryOptions: () => ({
              queryKey: ["org", "workspace", "connectors", "listSections"],
            }),
          },
        },
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: useSuspenseQueryMock,
}));

const { ConnectorsActions } = await import("./connectors-actions");

beforeEach(() => {
  connectorState = null;
  scopeState = "team";
  setScopeMock.mockReset();
  useSuspenseQueryMock.mockReset();
  useSuspenseQueryMock.mockReturnValue({
    data: {
      teamConnectors: [{ provider: "linear" }, { provider: "x" }],
      yourConnectors: [{ provider: "granola" }],
    },
  });
});

describe("ConnectorsActions", () => {
  it("renders the ownership switcher in the actions slot", () => {
    render(<ConnectorsActions />);

    expect(
      screen.getByRole("tablist", { name: "Connector ownership" })
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: "Team" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("tab", { name: "Personal" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.getByText("2")).toBeVisible();
    expect(screen.getByText("1")).toBeVisible();
  });

  it("writes the selected ownership scope to the shared URL param", () => {
    render(<ConnectorsActions />);

    fireEvent.click(screen.getByRole("tab", { name: "Personal" }));

    expect(setScopeMock).toHaveBeenCalledWith("personal");
  });

  it("shows Personal as active while a personal connector is selected", () => {
    connectorState = "granola";

    render(<ConnectorsActions />);

    expect(screen.getByRole("tab", { name: "Team" })).toHaveAttribute(
      "aria-selected",
      "false"
    );
    expect(screen.getByRole("tab", { name: "Personal" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });
});
