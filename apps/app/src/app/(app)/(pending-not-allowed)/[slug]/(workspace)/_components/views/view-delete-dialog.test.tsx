import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { ViewDeleteDialog } = await import("./view-delete-dialog");

describe("ViewDeleteDialog", () => {
  let onConfirm: ReturnType<typeof vi.fn>;
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onConfirm = vi.fn().mockResolvedValue(undefined);
    onOpenChange = vi.fn();
  });

  it("renders nothing when no view is targeted", () => {
    render(
      <ViewDeleteDialog
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        view={null}
      />
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("names the targeted view in the confirmation copy", () => {
    render(
      <ViewDeleteDialog
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        view={{ name: "High priority", publicId: "v_1" }}
      />
    );
    expect(screen.getByText(/High priority/)).toBeInTheDocument();
  });

  it("confirms deletion and closes", async () => {
    render(
      <ViewDeleteDialog
        onConfirm={onConfirm}
        onOpenChange={onOpenChange}
        view={{ name: "High priority", publicId: "v_1" }}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete view" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("v_1"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
