import { useCallback, useEffect, useState } from "react";

// Custom event name for sidebar toggle
export const SIDEBAR_TOGGLE_EVENT = "sidebar-toggle";

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const sendCommand = useCallback((command: string) => {
    window.electronAPI.send("window-control", command);
  }, []);

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

  // Keyboard shortcuts have been moved to useKeyboardShortcuts hook

  return (
    <div
      className="absolute top-0 right-0 left-0 z-50 bg-transparent select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="flex h-10 items-center pt-8 pl-4">
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
          ></button>
          <button
            className="flex h-3 w-3 items-center justify-center rounded-full bg-yellow-500 transition-opacity hover:opacity-100"
            onClick={() => sendCommand("minimize")}
            style={
              {
                WebkitAppRegion: "no-drag",
                opacity: isHovering ? 1 : 0.8,
              } as React.CSSProperties
            }
          ></button>
          <button
            className="flex h-3 w-3 items-center justify-center rounded-full bg-green-500 transition-opacity hover:opacity-100"
            onClick={() => sendCommand(isMaximized ? "unmaximize" : "maximize")}
            style={
              {
                WebkitAppRegion: "no-drag",
                opacity: isHovering ? 1 : 0.8,
              } as React.CSSProperties
            }
          ></button>
        </div>
      </div>
    </div>
  );
}

export default TitleBar;
