import { useCallback, useState } from "react";

import {
  closeWindow,
  maximizeWindow,
  minimizeWindow,
} from "../helpers/window-helpers";

// Custom event name for sidebar toggle
export const SIDEBAR_TOGGLE_EVENT = "sidebar-toggle";

export function TitleBar() {
  const [isHovering, setIsHovering] = useState(false);

  const sendCommand = useCallback((command: string) => {
    if (command === "close") {
      closeWindow();
    } else if (command === "minimize") {
      minimizeWindow();
    } else if (command === "maximize" || command === "unmaximize") {
      maximizeWindow();
    }
  }, []);

  // Keyboard shortcuts have been moved to useKeyboardShortcuts hook

  return (
    <div
      className="absolute top-0 right-0 left-0 z-50 bg-transparent select-none"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="flex h-10 items-center justify-between px-4 pt-8">
        {/* Left side - macOS style window controls */}
        <div className="flex items-center gap-2">
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
            onClick={() => sendCommand("maximize")}
            style={
              {
                WebkitAppRegion: "no-drag",
                opacity: isHovering ? 1 : 0.8,
              } as React.CSSProperties
            }
          ></button>
        </div>
        {/* Centered Title */}
        <div className="flex-grow text-center">
          <h1 className="inline-block font-mono text-xs font-bold">
            Lightfast{" "}
            <span className="relative inline-block bg-gradient-to-r from-sky-400 via-fuchsia-400 to-orange-400 bg-clip-text font-mono text-transparent">
              Computer
            </span>
          </h1>
        </div>
        {/* Right side - invisible buttons for symmetry */}
        <div className="flex items-center gap-2">
          <button className="pointer-events-none flex h-3 w-3 rounded-full opacity-0"></button>
          <button className="pointer-events-none flex h-3 w-3 rounded-full opacity-0"></button>
          <button className="pointer-events-none flex h-3 w-3 rounded-full opacity-0"></button>
        </div>
      </div>
    </div>
  );
}

export default TitleBar;
