import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewSwitcherProps } from "../../_components/views/view-switcher";
import type { PeopleViewRow } from "./people-views-model";

interface Params {
  provider: string;
  type: string;
  view: string | null;
}

let paramsState: Params;
const setParamsMock = vi.fn();

vi.mock("nuqs", () => ({
  parseAsString: { withDefault: () => "mock-parser" },
  useQueryStates: () => [paramsState, setParamsMock] as const,
}));

let viewsData: PeopleViewRow[] = [];
const createAsync = vi.fn();
const deleteAsync = vi.fn();

vi.mock("./use-people-views-query", () => ({
  useCreatePeopleView: () => ({ mutateAsync: createAsync }),
  useDeletePeopleView: () => ({ mutateAsync: deleteAsync }),
  usePeopleViewsQuery: () => ({ data: viewsData }),
}));

// Capture the props handed to the shared switcher and expose buttons that fire
// the entity callbacks, so we test the people wiring in isolation.
let switcherProps: ViewSwitcherProps;
vi.mock("../../_components/views/view-switcher", () => ({
  ViewSwitcher: (props: ViewSwitcherProps) => {
    switcherProps = props;
    return (
      <div>
        <button onClick={props.onSelectAll} type="button">
          all
        </button>
        <button onClick={() => props.onSelectView("peoview_1")} type="button">
          select
        </button>
        <button onClick={() => void props.onCreate("My view")} type="button">
          create
        </button>
        <button onClick={() => void props.onDelete("peoview_1")} type="button">
          delete
        </button>
      </div>
    );
  },
}));

const { PeopleViewSwitcher } = await import("./people-view-switcher");

function makeView(overrides: Partial<PeopleViewRow> = {}): PeopleViewRow {
  return {
    clerkOrgId: "org_test",
    config: { filters: { providers: ["x"], types: ["handle"] } },
    createdAt: new Date("2026-05-31T00:00:00.000Z"),
    createdByUserId: "user_test",
    id: 1,
    name: "X handles",
    publicId: "peoview_1",
    updatedAt: new Date("2026-05-31T00:00:00.000Z"),
    ...overrides,
  } as PeopleViewRow;
}

beforeEach(() => {
  paramsState = { provider: "", type: "", view: null };
  viewsData = [];
  createAsync.mockReset().mockResolvedValue({ publicId: "peoview_new" });
  deleteAsync.mockReset().mockResolvedValue(undefined);
  setParamsMock.mockReset();
});

describe("PeopleViewSwitcher", () => {
  it("maps the active view param onto the shared switcher", () => {
    render(<PeopleViewSwitcher />);
    expect(switcherProps.activeViewId).toBeNull();
  });

  it("stamps a view's filters and ?view atomically on select", () => {
    viewsData = [makeView()];
    render(<PeopleViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "select" }));
    expect(setParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "x",
        type: "handle",
        view: "peoview_1",
      })
    );
  });

  it("clears filters and ?view on All", () => {
    paramsState.view = "peoview_1";
    render(<PeopleViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "all" }));
    expect(setParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "", type: "", view: null })
    );
  });

  it("creates a view then selects it", async () => {
    render(<PeopleViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "create" }));
    await waitFor(() =>
      expect(createAsync).toHaveBeenCalledWith(
        expect.objectContaining({ name: "My view" })
      )
    );
    await waitFor(() =>
      expect(setParamsMock).toHaveBeenCalledWith({ view: "peoview_new" })
    );
  });

  it("deletes the active view and clears ?view", async () => {
    paramsState.view = "peoview_1";
    viewsData = [makeView()];
    render(<PeopleViewSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    await waitFor(() =>
      expect(deleteAsync).toHaveBeenCalledWith({ publicId: "peoview_1" })
    );
    await waitFor(() =>
      expect(setParamsMock).toHaveBeenCalledWith({ view: null })
    );
  });
});
