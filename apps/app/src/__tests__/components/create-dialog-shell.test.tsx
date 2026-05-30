import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@repo/ui/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  DialogClose: ({ children }: { children?: ReactNode }) => children,
  DialogContent: ({ children }: { children?: ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogDescription: ({ children }: { children?: ReactNode }) => (
    <p>{children}</p>
  ),
  DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

const { CreateDialogShell } = await import("~/components/create-dialog-shell");

function renderShell(overrides: Record<string, unknown> = {}) {
  const onOpenChange = vi.fn();
  render(
    <CreateDialogShell
      description="desc"
      footerLeft={<span>left-slot</span>}
      footerRight={<span>right-slot</span>}
      onOpenChange={onOpenChange}
      open
      org={{ initials: "L", name: "Lightfast" }}
      title="New signal"
      {...overrides}
    >
      <div>body-slot</div>
    </CreateDialogShell>
  );
  return { onOpenChange };
}

describe("CreateDialogShell", () => {
  it("renders the breadcrumb, body, and footer slots", () => {
    renderShell();
    expect(screen.getByText("Lightfast")).toBeInTheDocument();
    expect(screen.getByText("New signal")).toBeInTheDocument();
    expect(screen.getByText("body-slot")).toBeInTheDocument();
    expect(screen.getByText("left-slot")).toBeInTheDocument();
    expect(screen.getByText("right-slot")).toBeInTheDocument();
  });

  it("falls back to a neutral label when org is null", () => {
    renderShell({ org: null });
    expect(screen.getByText("Workspace")).toBeInTheDocument();
  });

  it("closes via the close button and disables it while busy", () => {
    const { onOpenChange } = renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables the close button when busy", () => {
    renderShell({ busy: true });
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
  });
});
