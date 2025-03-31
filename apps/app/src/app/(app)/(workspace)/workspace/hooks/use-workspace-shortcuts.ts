import { useCallback, useEffect } from "react";

import { useActiveView } from "../hooks/use-active-view";
import { useInspectorStore } from "../providers/inspector-store-provider";
import { useCommandDialog } from "./use-command-dialog";

export const useWorkspaceShortcuts = () => {
  const { isWorkspaceActive } = useActiveView();
  const { setIsOpen: setInspectorOpen, isOpen: isInspectorOpen } =
    useInspectorStore((state) => state);
  const { open: openCommandDialog } = useCommandDialog();
  const handleInspectorToggle = useCallback(
    (e: KeyboardEvent) => {
      if (!isWorkspaceActive) return;

      if (e.key === "p") {
        e.preventDefault();
        setInspectorOpen(!isInspectorOpen);
      }
    },
    [isInspectorOpen, isWorkspaceActive, setInspectorOpen],
  );

  const handleCommandPalette = useCallback(
    (e: KeyboardEvent) => {
      if (!isWorkspaceActive) return;

      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openCommandDialog();
      }
    },
    [isWorkspaceActive, openCommandDialog],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleInspectorToggle);
    document.addEventListener("keydown", handleCommandPalette);

    return () => {
      document.removeEventListener("keydown", handleInspectorToggle);
      document.removeEventListener("keydown", handleCommandPalette);
    };
  }, [handleInspectorToggle, handleCommandPalette]);
};
