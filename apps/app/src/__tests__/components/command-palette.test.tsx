import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("~/hooks/use-active-org", () => ({
  useActiveOrg: () => ({
    id: "org_1",
    initials: "L",
    name: "Lightfast",
    slug: "lightfast",
  }),
}));

vi.mock("@repo/ui/components/ui/command", () => ({
  CommandDialog: ({
    children,
    open,
  }: {
    children?: ReactNode;
    open?: boolean;
  }) => (open ? <div role="dialog">{children}</div> : null),
  CommandInput: (props: Record<string, unknown>) => <input {...props} />,
  CommandList: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  CommandEmpty: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  CommandGroup: ({
    children,
    heading,
  }: {
    children?: ReactNode;
    heading?: string;
  }) => (
    <div>
      <div>{heading}</div>
      {children}
    </div>
  ),
  CommandItem: ({
    children,
    onSelect,
  }: {
    children?: ReactNode;
    onSelect?: () => void;
  }) => (
    <button onClick={() => onSelect?.()} type="button">
      {children}
    </button>
  ),
  CommandShortcut: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
}));

const { CommandPalette } = await import("~/components/command-palette");

function renderPalette() {
  const onCreateSignal = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <CommandPalette
      onCreateSignal={onCreateSignal}
      onOpenChange={onOpenChange}
      open
    />
  );
  return { onCreateSignal, onOpenChange };
}

beforeEach(() => {
  pushMock.mockReset();
});

describe("CommandPalette", () => {
  it("invokes create signal and closes", () => {
    const { onCreateSignal, onOpenChange } = renderPalette();
    fireEvent.click(screen.getByRole("button", { name: /Create signal/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onCreateSignal).toHaveBeenCalled();
  });

  it("routes to a section and closes", () => {
    const { onOpenChange } = renderPalette();
    fireEvent.click(screen.getByRole("button", { name: "People" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(pushMock).toHaveBeenCalledWith("/lightfast/people");
  });

  it("renders all go-to destinations", () => {
    renderPalette();
    for (const label of ["Signals", "People", "Automations", "Settings"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });
});
