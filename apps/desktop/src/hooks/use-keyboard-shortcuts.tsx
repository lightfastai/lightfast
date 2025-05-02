import { useCallback, useEffect } from "react";
import { SIDEBAR_TOGGLE_EVENT } from "@/components/title-bar";

import { useSidebar } from "@repo/ui/components/ui/sidebar";

/**
 * Custom hook to handle global keyboard shortcuts
 */
export function useKeyboardShortcuts() {
  const { toggleSidebar } = useSidebar();

  // Handle sidebar toggle with both Cmd+B and Cmd+S (for backward compatibility)
  const handleToggleSidebar = useCallback(() => {
    toggleSidebar();
    // Dispatch event to notify other components about the sidebar toggle
    window.dispatchEvent(new CustomEvent(SIDEBAR_TOGGLE_EVENT));
  }, [toggleSidebar]);

  // Set up keyboard event listeners
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Allow Cmd+S or Ctrl+S for toggling sidebar
      if (
        (event.key === "s" || event.key === "S") &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault(); // Prevent default browser save action
        handleToggleSidebar();
      }

      // Also maintain Cmd+B for consistency with the existing shortcut
      if (
        (event.key === "b" || event.key === "B") &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        handleToggleSidebar();
      }
    };

    // Add event listener
    window.addEventListener("keydown", handleKeyDown);

    // Clean up
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleToggleSidebar]);

  return null; // This hook doesn't return anything, it just sets up the event listeners
}
