import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/components/command-palette", () => ({
  CommandPalette: ({ open }: { open: boolean }) =>
    open ? <div>palette-open</div> : null,
}));

vi.mock(
  "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-create-dialog",
  () => ({
    SignalCreateDialog: ({ open }: { open: boolean }) =>
      open ? <div>create-open</div> : null,
  })
);

const { WorkspaceCommandMenu, useWorkspaceCommands } = await import(
  "~/components/workspace-command-menu"
);

function Probe() {
  const { openCreateSignal } = useWorkspaceCommands();
  return (
    <button onClick={openCreateSignal} type="button">
      probe-create
    </button>
  );
}

describe("WorkspaceCommandMenu", () => {
  it("opens the palette on Cmd+K", () => {
    render(
      <WorkspaceCommandMenu>
        <div>child</div>
      </WorkspaceCommandMenu>
    );
    expect(screen.queryByText("palette-open")).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByText("palette-open")).toBeInTheDocument();
  });

  it("opens the create dialog on C", () => {
    render(
      <WorkspaceCommandMenu>
        <div>child</div>
      </WorkspaceCommandMenu>
    );
    fireEvent.keyDown(window, { key: "c" });
    expect(screen.getByText("create-open")).toBeInTheDocument();
  });

  it("ignores C while typing in an input", () => {
    render(
      <WorkspaceCommandMenu>
        <input aria-label="field" />
      </WorkspaceCommandMenu>
    );
    fireEvent.keyDown(screen.getByLabelText("field"), { key: "c" });
    expect(screen.queryByText("create-open")).not.toBeInTheDocument();
  });

  it("exposes openCreateSignal through context", () => {
    render(
      <WorkspaceCommandMenu>
        <Probe />
      </WorkspaceCommandMenu>
    );
    fireEvent.click(screen.getByRole("button", { name: "probe-create" }));
    expect(screen.getByText("create-open")).toBeInTheDocument();
  });
});
