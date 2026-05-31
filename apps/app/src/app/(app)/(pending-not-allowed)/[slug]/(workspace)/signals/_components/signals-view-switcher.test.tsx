import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SignalViewRow } from "./signals-views-model";

// --- URL param state (nuqs) -------------------------------------------------
const setDispositionMock = vi.fn();
const setKindMock = vi.fn();
const setPriorityMock = vi.fn();
const setPeopleMock = vi.fn();
const setLayoutMock = vi.fn();
const setSavedViewMock = vi.fn();

let dispositionState = "";
let kindState = "";
let priorityState = "";
let peopleState = "all";
let layoutState = "list";
let savedViewState: string | null = null;

vi.mock("nuqs", () => ({
  parseAsString: { withDefault: () => "mock-parser" },
  parseAsStringLiteral: () => ({ withDefault: () => "mock-parser" }),
  useQueryState: (key: string) => {
    if (key === "disposition") {
      return [dispositionState, setDispositionMock];
    }
    if (key === "kind") {
      return [kindState, setKindMock];
    }
    if (key === "priority") {
      return [priorityState, setPriorityMock];
    }
    if (key === "people") {
      return [peopleState, setPeopleMock];
    }
    if (key === "layout") {
      return [layoutState, setLayoutMock];
    }
    return [savedViewState, setSavedViewMock];
  },
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
      layout: "board",
    },
    createdAt: new Date("2026-05-30T01:00:00.000Z"),
    updatedAt: new Date("2026-05-30T01:00:00.000Z"),
    ...overrides,
  } as SignalViewRow;
}

beforeEach(() => {
  dispositionState = "";
  kindState = "";
  priorityState = "";
  peopleState = "all";
  layoutState = "list";
  savedViewState = null;
  viewsData = [];
  dialogProps = null;
  vi.clearAllMocks();
});

function openMenu() {
  fireEvent.pointerDown(
    screen.getByRole("button", { name: /All signals|My follow-ups/ })
  );
}

describe("SignalsViewSwitcher", () => {
  it('labels the trigger "All signals" when no saved view is active', () => {
    render(<SignalsViewSwitcher />);
    expect(
      screen.getByRole("button", { name: /All signals/ })
    ).toBeInTheDocument();
  });

  it("lists the caller's saved views", () => {
    viewsData = [makeView()];
    render(<SignalsViewSwitcher />);
    openMenu();

    expect(
      screen.getByRole("menuitem", { name: /My follow-ups/ })
    ).toBeInTheDocument();
  });

  it("selecting a view stamps its params and sets ?view", () => {
    viewsData = [makeView()];
    render(<SignalsViewSwitcher />);
    openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: /My follow-ups/ }));

    expect(setSavedViewMock).toHaveBeenCalledWith("sigview_1");
    expect(setKindMock).toHaveBeenCalledWith("follow_up");
    expect(setLayoutMock).toHaveBeenCalledWith("board");
  });

  it('selecting "All signals" clears the filters and ?view', () => {
    savedViewState = "sigview_1";
    viewsData = [makeView()];
    render(<SignalsViewSwitcher />);
    openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: /All signals/ }));

    expect(setSavedViewMock).toHaveBeenCalledWith(null);
    expect(setKindMock).toHaveBeenCalledWith("");
  });

  it('"New view" opens the dialog and saving sets ?view to the new id', () => {
    render(<SignalsViewSwitcher />);
    openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: /New view/ }));
    expect(dialogProps?.open).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "stub-save" }));
    expect(setSavedViewMock).toHaveBeenCalledWith("sigview_new");
  });

  it("deleting the active view removes it and resets to All signals", () => {
    savedViewState = "sigview_1";
    kindState = "follow_up";
    viewsData = [makeView()];
    render(<SignalsViewSwitcher />);
    openMenu();

    fireEvent.click(
      screen.getByRole("button", { name: "Delete My follow-ups" })
    );

    expect(deleteMutate).toHaveBeenCalledWith(
      { publicId: "sigview_1" },
      expect.anything()
    );
    expect(setSavedViewMock).toHaveBeenCalledWith(null);
    expect(setKindMock).toHaveBeenCalledWith("");
    expect(setDispositionMock).toHaveBeenCalledWith("");
    expect(setPriorityMock).toHaveBeenCalledWith("");
    expect(setPeopleMock).toHaveBeenCalledWith("all");
    expect(setLayoutMock).toHaveBeenCalledWith("list");
  });
});
