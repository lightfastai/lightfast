import { useCallback } from "react";

import { useEditorStore } from "../providers/editor-store-provider";
import { ActiveView } from "../types/active-view";
import { useActiveView } from "./use-active-view";

export const useCommandDialog = () => {
  const { isCommandDialogOpen, setIsCommandDialogOpen } = useEditorStore(
    (state) => state,
  );
  const { setActiveView } = useActiveView();

  const openCommandDialog = useCallback(() => {
    setIsCommandDialogOpen(true);
    setActiveView(ActiveView.COMMAND);
  }, [setIsCommandDialogOpen, setActiveView]);

  const closeCommandDialog = useCallback(() => {
    setIsCommandDialogOpen(false);
    setActiveView(ActiveView.WORKSPACE);
  }, [setIsCommandDialogOpen, setActiveView]);

  return {
    isOpen: isCommandDialogOpen,
    open: openCommandDialog,
    close: closeCommandDialog,
  };
};
