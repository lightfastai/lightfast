import { fireEvent, render, screen } from "@testing-library/react";
import { LayoutGrid } from "lucide-react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewSwitcherProps } from "./view-switcher";

vi.mock("@repo/ui/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  // Collapsed by default — overflow rows only exist when opened, which we don't
  // drive here (partition logic is covered by partition-views.test).
  DropdownMenuContent: () => null,
  DropdownMenuItem: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("@repo/ui/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
    open ? <div role="dialog">{children}</div> : null,
  DialogActionButton: ({
    children,
    variant: _variant,
    ...props
  }: { children?: ReactNode; variant?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  DialogActions: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogClose: ({ children }: { children?: ReactNode }) => <>{children}</>,
  DialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
  DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@repo/ui/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

const { ViewSwitcher } = await import("./view-switcher");

function makeViews(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    name: `View ${i + 1}`,
    publicId: `v_${i + 1}`,
  }));
}

describe("ViewSwitcher", () => {
  let props: ViewSwitcherProps;

  beforeEach(() => {
    props = {
      activeViewId: null,
      allLabel: "All signals",
      icon: LayoutGrid,
      onCreate: vi.fn().mockResolvedValue(undefined),
      onDelete: vi.fn().mockResolvedValue(undefined),
      onSelectAll: vi.fn(),
      onSelectView: vi.fn(),
      views: [],
    };
  });

  it("renders the All pill", () => {
    render(<ViewSwitcher {...props} />);
    expect(
      screen.getByRole("button", { name: "All signals" })
    ).toBeInTheDocument();
  });

  it("renders one pill per view and no overflow within the cap", () => {
    render(<ViewSwitcher {...props} views={makeViews(3)} />);
    expect(screen.getByRole("button", { name: "View 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View 3" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More views" })).toBeNull();
  });

  it("collapses past the cap into a +N overflow trigger", () => {
    render(<ViewSwitcher {...props} views={makeViews(5)} />);
    expect(
      screen.getByRole("button", { name: "More views" })
    ).toHaveTextContent("+2");
    expect(screen.queryByRole("button", { name: "View 4" })).toBeNull();
  });

  it("selects a view when its pill is clicked", () => {
    render(<ViewSwitcher {...props} views={makeViews(2)} />);
    fireEvent.click(screen.getByRole("button", { name: "View 2" }));
    expect(props.onSelectView).toHaveBeenCalledWith("v_2");
  });

  it("selects All when the All pill is clicked", () => {
    render(<ViewSwitcher {...props} activeViewId="v_1" views={makeViews(2)} />);
    fireEvent.click(screen.getByRole("button", { name: "All signals" }));
    expect(props.onSelectAll).toHaveBeenCalledTimes(1);
  });

  it("opens the create dialog from the + button", () => {
    render(<ViewSwitcher {...props} />);
    expect(screen.queryByRole("heading", { name: "Save view" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "New view" }));
    expect(
      screen.getByRole("heading", { name: "Save view" })
    ).toBeInTheDocument();
  });

  it("opens a delete confirm (not an immediate delete) from a pill", () => {
    render(<ViewSwitcher {...props} views={makeViews(1)} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete View 1" }));
    expect(
      screen.getByRole("heading", { name: "Delete view" })
    ).toBeInTheDocument();
    expect(props.onDelete).not.toHaveBeenCalled();
  });
});
