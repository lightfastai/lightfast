import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewSwitcherProps } from "../../_components/views/view-switcher";
import type { SignalViewRow } from "./signals-views-model";

interface Params {
  disposition: string;
  kind: string;
  people: "all" | "routed";
  priority: string;
  view: string | null;
}

let paramsState: Params;
const setParamsMock = vi.fn();

vi.mock("nuqs", () => ({
  parseAsString: { withDefault: () => "mock-parser" },
  parseAsStringLiteral: () => ({ withDefault: () => "mock-parser" }),
  useQueryStates: () => [paramsState, setParamsMock] as const,
}));

let viewsData: SignalViewRow[] = [];
const createAsync = vi.fn();
const deleteAsync = vi.fn();

vi.mock("./use-signal-views-query", () => ({
  useCreateSignalView: () => ({ mutateAsync: createAsync }),
  useDeleteSignalView: () => ({ mutateAsync: deleteAsync }),
  useSignalViewsQuery: () => ({ data: viewsData }),
}));

// Capture the props handed to the shared switcher and expose buttons that fire
// the entity callbacks, so we test the signals wiring in isolation.
let switcherProps: ViewSwitcherProps;
vi.mock("../../_components/views/view-switcher", () => ({
  ViewSwitcher: (props: ViewSwitcherProps) => {
    switcherProps = props;
    return (
      <div>
        <button onClick={props.onSelectAll} type="button">
          all
        </button>
        <button onClick={() => props.onSelectView("sigview_1")} type="button">
          select
        </button>
        <button onClick={() => void props.onCreate("My view")} type="button">
          create
        </button>
        <button onClick={() => void props.onDelete("sigview_1")} type="button">
          delete
        </button>
      </div>
    );
  },
}));

const { SignalsViewSwitcher } = await import("./signals-view-switcher");

function makeView(overrides: Partial<SignalViewRow> = {}): SignalViewRow {
  return {
    clerkOrgId: "org_test",
    config: {
      filters: {
        dispositions: ["actionable"],
        kinds: ["bug"],
        peopleRouted: true,
        priorities: ["urgent"],
      },
    },
    createdAt: new Date("2026-05-31T00:00:00.000Z"),
    createdByUserId: "user_test",
    id: 1,
    name: "High priority",
    publicId: "sigview_1",
    updatedAt: new Date("2026-05-31T00:00:00.000Z"),
    ...overrides,
  } as SignalViewRow;
}

beforeEach(() => {
  paramsState = {
    disposition: "",
    kind: "",
    people: "all",
    priority: "",
    view: null,
  };
  viewsData = [];
  createAsync.mockReset().mockResolvedValue({ publicId: "sigview_new" });
  deleteAsync.mockReset().mockResolvedValue(undefined);
  setParamsMock.mockReset();
});

describe("SignalsViewSwitcher", () => {
  it("passes signals identity to the shared switcher", () => {
    render(<SignalsViewSwitcher />);
    expect(switcherProps.allLabel).toBe("All signals");
  });

  it("stamps a view's filters and ?view atomically on select", () => {
    viewsData = [makeView()];
    render(<SignalsViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "select" }));
    expect(setParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        disposition: "actionable",
        kind: "bug",
        people: "routed",
        priority: "urgent",
        view: "sigview_1",
      })
    );
  });

  it("clears filters and ?view on All", () => {
    paramsState.view = "sigview_1";
    render(<SignalsViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "all" }));
    expect(setParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        disposition: "",
        kind: "",
        people: "all",
        priority: "",
        view: null,
      })
    );
  });

  it("creates a view then selects it", async () => {
    render(<SignalsViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "create" }));
    await waitFor(() =>
      expect(createAsync).toHaveBeenCalledWith(
        expect.objectContaining({ name: "My view" })
      )
    );
    await waitFor(() =>
      expect(setParamsMock).toHaveBeenCalledWith({ view: "sigview_new" })
    );
  });

  it("deletes the active view and clears ?view", async () => {
    paramsState.view = "sigview_1";
    viewsData = [makeView()];
    render(<SignalsViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    await waitFor(() =>
      expect(deleteAsync).toHaveBeenCalledWith({ publicId: "sigview_1" })
    );
    await waitFor(() =>
      expect(setParamsMock).toHaveBeenCalledWith({ view: null })
    );
  });
});
