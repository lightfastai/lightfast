import React, { useEffect, useRef, useState } from "react";

import { useSidebar } from "@repo/ui/components/ui/sidebar";

// Type definition for the electron API
declare global {
  interface Window {
    electronAPI?: {
      send: (channel: string, ...args: any[]) => void;
      on: (
        channel: string,
        listener: (...args: any[]) => void,
      ) => (() => void) | undefined;
    };
  }
}

// Custom event name for sidebar toggle
export const SIDEBAR_TOGGLE_EVENT = "app:sidebar:toggle";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const cleanupFuncs = useRef<(() => void)[]>([]);

  // Use the sidebar context to get the toggle function
  const { toggleSidebar, open } = useSidebar();

  // Enhanced toggle sidebar function
  const handleToggleSidebar = () => {
    toggleSidebar();
    // Dispatch a custom event that other components can listen for
    window.dispatchEvent(
      new CustomEvent(SIDEBAR_TOGGLE_EVENT, {
        detail: { isOpen: !open },
      }),
    );
  };

  useEffect(() => {
    const handleMaximized = () => setIsMaximized(true);
    const handleUnmaximized = () => setIsMaximized(false);

    if (window.electronAPI?.on) {
      const cleanupMaximized = window.electronAPI.on(
        "window-maximized",
        handleMaximized,
      );
      const cleanupUnmaximized = window.electronAPI.on(
        "window-unmaximized",
        handleUnmaximized,
      );

      if (cleanupMaximized) cleanupFuncs.current.push(cleanupMaximized);
      if (cleanupUnmaximized) cleanupFuncs.current.push(cleanupUnmaximized);
    } else {
      console.warn(
        "Electron electronAPI not found. Maximize state won't sync.",
      );
    }

    return () => {
      cleanupFuncs.current.forEach((cleanup) => cleanup());
      cleanupFuncs.current = [];
    };
  }, []);

  // Add keyboard shortcut for toggling sidebar (Cmd+S)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd+S (macOS) or Ctrl+S (Windows/Linux)
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault(); // Prevent default save action
        handleToggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [toggleSidebar, open]);

  const handleMinimize = () => {
    window.electronAPI?.send("minimize-window");
  };

  const handleMaximize = () => {
    window.electronAPI?.send("maximize-window");
  };

  const handleClose = () => {
    window.electronAPI?.send("close-window");
  };

  return (
    <div
      className="absolute top-0 right-0 left-0 z-[1000] flex h-8 items-center bg-none pt-8 pl-8"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="flex items-center space-x-6 pl-1">
        {/* macOS Traffic Lights */}
        <div
          className="flex space-x-2"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
        >
          <button
            onClick={handleClose}
            className="h-3 w-3 rounded-full bg-red-500 hover:bg-red-600 focus:outline-none active:bg-red-700"
            aria-label="Close"
          />
          <button
            onClick={handleMinimize}
            className="h-3 w-3 rounded-full bg-yellow-500 hover:bg-yellow-600 focus:outline-none active:bg-yellow-700"
            aria-label="Minimize"
          />
          <button
            onClick={handleMaximize}
            className="h-3 w-3 rounded-full bg-green-500 hover:bg-green-600 focus:outline-none active:bg-green-700"
            aria-label={isMaximized ? "Restore" : "Maximize"}
          />
        </div>

        {/* Sidebar Trigger Button */}
        <button
          onClick={handleToggleSidebar}
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground flex h-6 w-6 items-center justify-center rounded-md focus:outline-none"
          style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          aria-label="Toggle Sidebar"
          title="Toggle Sidebar (⌘S)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <line x1="9" x2="9" y1="3" y2="21" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default TitleBar;
