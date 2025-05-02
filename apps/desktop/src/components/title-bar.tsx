import { useCallback, useEffect, useState } from "react";
import { Minus, X } from "lucide-react";

import { SidebarTrigger, useSidebar } from "@repo/ui/components/ui/sidebar";

// Custom event name for sidebar toggle
export const SIDEBAR_TOGGLE_EVENT = "sidebar-toggle";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
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
      className="absolute top-0 right-0 left-0 z-50 bg-transparent select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="flex h-10 items-center pt-8 pl-8">
        {/* Left side - macOS style window controls */}
        <div className="mr-4 flex items-center gap-2">
          <button
            className="flex h-3 w-3 items-center justify-center rounded-full bg-red-500 transition-opacity hover:opacity-100"
            onClick={() => sendCommand("close")}
            style={
              {
                WebkitAppRegion: "no-drag",
                opacity: isHovering ? 1 : 0.8,
              } as React.CSSProperties
            }
          >
            {isHovering && <X className="h-2 w-2 text-red-800" />}
          </button>
          <button
            className="flex h-3 w-3 items-center justify-center rounded-full bg-yellow-500 transition-opacity hover:opacity-100"
            onClick={() => sendCommand("minimize")}
            style={
              {
                WebkitAppRegion: "no-drag",
                opacity: isHovering ? 1 : 0.8,
              } as React.CSSProperties
            }
          >
            {isHovering && <Minus className="h-2 w-2 text-yellow-800" />}
          </button>
          <button
            className="flex h-3 w-3 items-center justify-center rounded-full bg-green-500 transition-opacity hover:opacity-100"
            onClick={() => sendCommand(isMaximized ? "unmaximize" : "maximize")}
            style={
              {
                WebkitAppRegion: "no-drag",
                opacity: isHovering ? 1 : 0.8,
              } as React.CSSProperties
            }
          >
            {isHovering && (
              <svg
                className="h-2 w-2 text-green-800"
                viewBox="0 0 12 12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 1.5h6M3 10.5h6M1.5 3v6M10.5 3v6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Center - App controls and title */}
        <div className="flex items-center">
          <SidebarTrigger
            style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
            className="size-7"
          />
        </div>
      </div>
    </div>
  );
}

export default TitleBar;
