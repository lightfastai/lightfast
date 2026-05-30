"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { SignalCreateDialog } from "~/app/(app)/(pending-not-allowed)/[slug]/(workspace)/signals/_components/signal-create-dialog";
import { CommandPalette } from "~/components/command-palette";

interface WorkspaceCommandsContextValue {
  openCreateSignal: () => void;
  openPalette: () => void;
}

const WorkspaceCommandsContext =
  createContext<WorkspaceCommandsContextValue | null>(null);

export function useWorkspaceCommands() {
  const context = useContext(WorkspaceCommandsContext);
  if (!context) {
    throw new Error(
      "useWorkspaceCommands must be used within WorkspaceCommandMenu"
    );
  }
  return context;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  );
}

export function WorkspaceCommandMenu({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createSignalOpen, setCreateSignalOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
        return;
      }
      if (
        event.key.toLowerCase() === "c" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey &&
        !isEditableTarget(event.target) &&
        !paletteOpen &&
        !createSignalOpen
      ) {
        event.preventDefault();
        setCreateSignalOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createSignalOpen, paletteOpen]);

  const value = useMemo<WorkspaceCommandsContextValue>(
    () => ({
      openCreateSignal: () => setCreateSignalOpen(true),
      openPalette: () => setPaletteOpen(true),
    }),
    []
  );

  return (
    <WorkspaceCommandsContext.Provider value={value}>
      {children}
      <CommandPalette
        onCreateSignal={() => setCreateSignalOpen(true)}
        onOpenChange={setPaletteOpen}
        open={paletteOpen}
      />
      <SignalCreateDialog
        onOpenChange={setCreateSignalOpen}
        open={createSignalOpen}
      />
    </WorkspaceCommandsContext.Provider>
  );
}
