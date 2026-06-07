import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setScopeMock = vi.fn();
const useSuspenseQueryMock = vi.fn();

let scopeState: "team" | "personal" = "team";

vi.mock("nuqs", () => ({
  parseAsStringLiteral: () => ({ withDefault: () => "mock-parser" }),
  useQueryState: () => [scopeState, setScopeMock] as const,
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
});
