import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SignalViewRow } from "./signals-views-model";

// --- URL param state (nuqs, batched via useQueryStates) ---------------------
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

// --- views data + mutations -------------------------------------------------
let viewsData: SignalViewRow[] = [];
const createMutate = vi.fn();
const deleteMutate = vi.fn(
  (_input: { publicId: string }, opts?: { onSuccess?: () => void }) => {
    opts?.onSuccess?.();
  }
);

vi.mock("./use-signal-views-query", () => ({
  useSignalViewsQuery: () => ({ data: viewsData }),
  useCreateSignalView: () => ({ mutate: createMutate, isPending: false }),
  useDeleteSignalView: () => ({ mutate: deleteMutate }),
}));

// Stub the dialog so we can drive its onCreated callback directly.
let dialogProps: {
  open: boolean;
  onCreated: (publicId: string) => void;
} | null = null;
vi.mock("./signal-create-view-dialog", () => ({
  SignalCreateViewDialog: (props: {
    open: boolean;
    onCreated: (publicId: string) => void;
  }) => {
    dialogProps = props;
    return props.open ? (
      <button onClick={() => props.onCreated("sigview_new")} type="button">
        stub-save
      </button>
    ) : null;
  },
}));

const { SignalsViewSwitcher } = await import("./signals-view-switcher");

function makeView(overrides: Partial<SignalViewRow> = {}): SignalViewRow {
  return {
    id: 1,
    publicId: "sigview_1",
    clerkOrgId: "org_test",
    createdByUserId: "user_test",
    name: "My follow-ups",
    config: {
      filters: {
        kinds: ["follow_up"],
        priorities: [],
        dispositions: [],
        peopleRouted: false,
      },
    },
    createdAt: new Date("2026-05-30T01:00:00.000Z"),
    updatedAt: new Date("2026-05-30T01:00:00.000Z"),
    ...overrides,
  } as SignalViewRow;
}

beforeEach(() => {
  paramsState = {
    disposition: "",
    kind: "",
    priority: "",
    people: "all",
    view: null,
  };
  viewsData = [];
  dialogProps = null;
  vi.clearAllMocks();
});

describe("SignalsViewSwitcher", () => {
  it('renders the "All signals" pill, active when no saved view is set', () => {
    render(<SignalsViewSwitcher />);
    expect(
      screen.getByRole("button", { name: "All signals" })
    ).toBeInTheDocument();
  });

  it("renders one always-visible pill per saved view (no dropdown)", () => {
    viewsData = [makeView()];
    render(<SignalsViewSwitcher />);
    // The select pill is directly present without opening any menu.
    expect(
      screen.getByRole("button", { name: "My follow-ups" })
    ).toBeInTheDocument();
  });

  it("clicking a view pill stamps its params and sets ?view atomically", () => {
    viewsData = [makeView()];
    render(<SignalsViewSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "My follow-ups" }));

    expect(setParamsMock).toHaveBeenCalledTimes(1);
    expect(setParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "follow_up",
        view: "sigview_1",
      })
    );
  });

  it('clicking "All signals" clears the filters and ?view', () => {
    paramsState.view = "sigview_1";
    viewsData = [makeView()];
    render(<SignalsViewSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "All signals" }));

    expect(setParamsMock).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "", view: null })
    );
  });

  it('"+" opens the dialog and saving sets ?view to the new id', () => {
    render(<SignalsViewSwitcher />);

    fireEvent.click(screen.getByRole("button", { name: "New view" }));
    expect(dialogProps?.open).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "stub-save" }));
    expect(setParamsMock).toHaveBeenCalledWith({ view: "sigview_new" });
  });

  it("deleting the active view removes it and clears ?view", () => {
    paramsState.view = "sigview_1";
    viewsData = [makeView()];
    render(<SignalsViewSwitcher />);

    fireEvent.click(
      screen.getByRole("button", { name: "Delete My follow-ups" })
    );

    expect(deleteMutate).toHaveBeenCalledWith(
      { publicId: "sigview_1" },
      expect.anything()
    );
    expect(setParamsMock).toHaveBeenCalledWith({ view: null });
  });
});
