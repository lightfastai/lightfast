import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PeopleViewRow } from "./people-views-model";

// --- URL param state (nuqs, batched via useQueryStates) ---------------------
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

// --- views data + mutations -------------------------------------------------
let viewsData: PeopleViewRow[] = [];
const createMutate = vi.fn();
const deleteMutate = vi.fn(
  (_input: { publicId: string }, opts?: { onSuccess?: () => void }) => {
    opts?.onSuccess?.();
  }
);

vi.mock("./use-people-views-query", () => ({
  usePeopleViewsQuery: () => ({ data: viewsData }),
  useCreatePeopleView: () => ({ mutate: createMutate, isPending: false }),
  useDeletePeopleView: () => ({ mutate: deleteMutate }),
}));

// Stub the dialog so we can drive its onCreated callback directly.
let dialogProps: {
  open: boolean;
  onCreated: (publicId: string) => void;
} | null = null;
vi.mock("./people-create-view-dialog", () => ({
  PeopleCreateViewDialog: (props: {
    open: boolean;
    onCreated: (publicId: string) => void;
  }) => {
    dialogProps = props;
    return props.open ? (
      <button onClick={() => props.onCreated("peoview_new")} type="button">
        stub-save
      </button>
    ) : null;
  },
}));

const { PeopleViewSwitcher } = await import("./people-view-switcher");

function makeView(overrides: Partial<PeopleViewRow> = {}): PeopleViewRow {
  return {
    id: 1,
    publicId: "peoview_1",
    clerkOrgId: "org_test",
    createdByUserId: "user_test",
    name: "X handles",
    config: {
      filters: {
        providers: ["x"],
        types: ["handle"],
      },
    },
    createdAt: new Date("2026-05-31T01:00:00.000Z"),
    updatedAt: new Date("2026-05-31T01:00:00.000Z"),
    ...overrides,
  } as PeopleViewRow;
}

beforeEach(() => {
  paramsState = { provider: "", type: "", view: null };
  viewsData = [];
  dialogProps = null;
  vi.clearAllMocks();
});

describe("PeopleViewSwitcher", () => {
  it('renders the "All people" pill, active when no saved view is set', () => {
    render(<PeopleViewSwitcher />);
    expect(
      screen.getByRole("button", { name: "All people" })
    ).toBeInTheDocument();
  });

  it("renders one always-visible pill per saved view (no dropdown)", () => {
    viewsData = [makeView()];
    render(<PeopleViewSwitcher />);
    expect(
      screen.getByRole("button", { name: "X handles" })
    ).toBeInTheDocument();
  });

  it("clicking a view pill stamps its params and sets ?view atomically", () => {
    viewsData = [makeView()];
    render(<PeopleViewSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "X handles" }));

    expect(setParamsMock).toHaveBeenCalledTimes(1);
    expect(setParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "x",
        type: "handle",
        view: "peoview_1",
      })
    );
  });

  it('clicking "All people" clears the filters and ?view', () => {
    paramsState.view = "peoview_1";
    viewsData = [makeView()];
    render(<PeopleViewSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "All people" }));

    expect(setParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "", type: "", view: null })
    );
  });

  it('"+" opens the dialog and saving sets ?view to the new id', () => {
    render(<PeopleViewSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "New view" }));
    expect(dialogProps?.open).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "stub-save" }));
    expect(setParamsMock).toHaveBeenCalledWith({ view: "peoview_new" });
  });

  it("deleting the active view removes it and clears ?view", () => {
    paramsState.view = "peoview_1";
    viewsData = [makeView()];
    render(<PeopleViewSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "Delete X handles" }));

    expect(deleteMutate).toHaveBeenCalledWith(
      { publicId: "peoview_1" },
      expect.anything()
    );
    expect(setParamsMock).toHaveBeenCalledWith({ view: null });
  });
});
