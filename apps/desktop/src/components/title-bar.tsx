import { useCallback, useEffect, useState } from "react";
import { Maximize, Minus, X } from "lucide-react";

import { useSidebar } from "@repo/ui/components/ui/sidebar";

// Custom event name for sidebar toggle
export const SIDEBAR_TOGGLE_EVENT = "sidebar-toggle";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const { toggleSidebar } = useSidebar();

  const sendCommand = useCallback((command: string) => {
    window.electronAPI.send("window-control", command);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    toggleSidebar();
    window.dispatchEvent(new CustomEvent(SIDEBAR_TOGGLE_EVENT));
  }, [toggleSidebar]);

  // Check if window is maximized
  useEffect(() => {
    const handleWindowStateChange = (
      _: unknown,
      isWindowMaximized: boolean,
    ) => {
      setIsMaximized(isWindowMaximized);
    };

    // Listen for window state changes
    const cleanup = window.electronAPI.on(
      "window-state-change",
      handleWindowStateChange,
    );

    // Get initial window state
    window.electronAPI
      .invoke("is-maximized")
      .then((maximized) => setIsMaximized(maximized))
      .catch((err) => console.error("Failed to get window state:", err));

    return cleanup;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "b" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        handleToggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleToggleSidebar]);

  return (
    <div
      className="bg-background/80 fixed top-0 right-0 left-0 z-50 backdrop-blur-md select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      <div className="flex h-10 items-center border-b px-2">
        {/* Left side - App controls */}
        <div className="flex items-center">
          <button
            className="hover:bg-muted mr-2 flex h-8 w-8 items-center justify-center rounded"
            onClick={handleToggleSidebar}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="1"
                y="3"
                width="14"
                height="1.5"
                rx="0.75"
                className="fill-current"
              />
              <rect
                x="1"
                y="7.25"
                width="14"
                height="1.5"
                rx="0.75"
                className="fill-current"
              />
              <rect
                x="1"
                y="11.5"
                width="14"
                height="1.5"
                rx="0.75"
                className="fill-current"
              />
            </svg>
          </button>
        </div>

        {/* Center - Title */}
        <div className="text-muted-foreground flex-grow text-center text-xs">
          Lightfast
        </div>

        {/* Right side - Window controls */}
        <div className="flex items-center">
          <button
            className="hover:bg-muted flex h-8 w-8 items-center justify-center rounded"
            onClick={() => sendCommand("minimize")}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            className="hover:bg-muted flex h-8 w-8 items-center justify-center rounded"
            onClick={() => sendCommand(isMaximized ? "unmaximize" : "maximize")}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            {isMaximized ? (
              <Maximize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </button>
          <button
            className="hover:bg-destructive hover:text-destructive-foreground flex h-8 w-8 items-center justify-center rounded"
            onClick={() => sendCommand("close")}
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default TitleBar;
