import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewSwitcherProps } from "../../_components/views/view-switcher";
import type { DecisionViewRow } from "./decisions-views-model";

interface Params {
  provider: string;
  status: string;
  view: string | null;
}

let paramsState: Params;
const setParamsMock = vi.fn();

vi.mock("nuqs", () => ({
  parseAsString: { withDefault: () => "mock-parser" },
  useQueryStates: () => [paramsState, setParamsMock] as const,
}));

let viewsData: DecisionViewRow[] = [];
const createAsync = vi.fn();
const deleteAsync = vi.fn();

vi.mock("./use-decision-views-query", () => ({
  useCreateDecisionView: () => ({ mutateAsync: createAsync }),
  useDeleteDecisionView: () => ({ mutateAsync: deleteAsync }),
  useDecisionViewsQuery: () => ({ data: viewsData }),
}));

// Capture the props handed to the shared switcher and expose buttons that fire
// the entity callbacks, so we test the decisions wiring in isolation.
let switcherProps: ViewSwitcherProps;
vi.mock("../../_components/views/view-switcher", () => ({
  ViewSwitcher: (props: ViewSwitcherProps) => {
    switcherProps = props;
    return (
      <div>
        <button onClick={props.onSelectAll} type="button">
          all
        </button>
        <button onClick={() => props.onSelectView("decview_1")} type="button">
          select
        </button>
        <button onClick={() => void props.onCreate("My view")} type="button">
          create
        </button>
        <button onClick={() => void props.onDelete("decview_1")} type="button">
          delete
        </button>
      </div>
    );
  },
}));

const { DecisionsViewSwitcher } = await import("./decisions-view-switcher");

function makeView(overrides: Partial<DecisionViewRow> = {}): DecisionViewRow {
  return {
    clerkOrgId: "org_test",
    config: { filters: { providers: ["linear"], statuses: ["failed"] } },
    createdAt: new Date("2026-06-06T00:00:00.000Z"),
    createdByUserId: "user_test",
    id: 1,
    name: "Failed Linear",
    publicId: "decview_1",
    updatedAt: new Date("2026-06-06T00:00:00.000Z"),
    ...overrides,
  } as DecisionViewRow;
}

beforeEach(() => {
  paramsState = { provider: "", status: "", view: null };
  viewsData = [];
  createAsync.mockReset().mockResolvedValue({ publicId: "decview_new" });
  deleteAsync.mockReset().mockResolvedValue(undefined);
  setParamsMock.mockReset();
});

describe("DecisionsViewSwitcher", () => {
  it("maps the active view param onto the shared switcher", () => {
    render(<DecisionsViewSwitcher />);
    expect(switcherProps.activeViewId).toBeNull();
  });

  it("stamps a view's filters and ?view atomically on select", () => {
    viewsData = [makeView()];
    render(<DecisionsViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "select" }));
    expect(setParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "linear",
        status: "failed",
        view: "decview_1",
      })
    );
  });

  it("clears filters and ?view on All", () => {
    paramsState.view = "decview_1";
    render(<DecisionsViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "all" }));
    expect(setParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "", status: "", view: null })
    );
  });

  it("creates a view then selects it", async () => {
    render(<DecisionsViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "create" }));
    await waitFor(() =>
      expect(createAsync).toHaveBeenCalledWith(
        expect.objectContaining({ name: "My view" })
      )
    );
    await waitFor(() =>
      expect(setParamsMock).toHaveBeenCalledWith({ view: "decview_new" })
    );
  });

  it("deletes the active view and clears ?view", async () => {
    paramsState.view = "decview_1";
    viewsData = [makeView()];
    render(<DecisionsViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    await waitFor(() =>
      expect(deleteAsync).toHaveBeenCalledWith({ publicId: "decview_1" })
    );
    await waitFor(() =>
      expect(setParamsMock).toHaveBeenCalledWith({ view: null })
    );
  });
});
