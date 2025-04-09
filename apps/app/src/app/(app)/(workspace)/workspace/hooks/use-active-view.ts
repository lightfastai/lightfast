import { useActiveViewStore } from "../providers/active-view-store-provider";
import { ActiveView } from "../types/active-view";

export const useActiveView = () => {
  const { activeView, setActiveView } = useActiveViewStore();

  const isWorkspaceActive = activeView === ActiveView.WORKSPACE;
  const isCommandActive = activeView === ActiveView.COMMAND;
  const isFileMenuActive = activeView === ActiveView.FILE_MENU;

  return {
    activeView,
    setActiveView,
    isWorkspaceActive,
    isCommandActive,
    isFileMenuActive,
  };
};
