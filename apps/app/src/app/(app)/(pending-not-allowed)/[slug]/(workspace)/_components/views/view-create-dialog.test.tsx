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

vi.mock("@repo/ui/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

const { ViewCreateDialog } = await import("./view-create-dialog");

describe("ViewCreateDialog", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;
  let onSubmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onOpenChange = vi.fn();
    onSubmit = vi.fn().mockResolvedValue({ publicId: "v_new" });
  });

  it("disables Save until a name is entered", () => {
    render(
      <ViewCreateDialog onOpenChange={onOpenChange} onSubmit={onSubmit} open />
    );
    expect(screen.getByRole("button", { name: "Save view" })).toBeDisabled();
  });

  it("submits the trimmed name and closes on success", async () => {
    render(
      <ViewCreateDialog onOpenChange={onOpenChange} onSubmit={onSubmit} open />
    );
    fireEvent.change(screen.getByPlaceholderText("View name"), {
      target: { value: "  High priority  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("High priority"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("submits on Enter", async () => {
    render(
      <ViewCreateDialog onOpenChange={onOpenChange} onSubmit={onSubmit} open />
    );
    const input = screen.getByPlaceholderText("View name");
    fireEvent.change(input, { target: { value: "Bugs" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("Bugs"));
  });
});
