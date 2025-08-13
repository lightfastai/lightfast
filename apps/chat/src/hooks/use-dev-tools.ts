"use client";

import { useEffect, useState } from "react";

export function useDevTools() {
  const [showErrorPanel, setShowErrorPanel] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  useEffect(() => {
    // Only in development - check at runtime
    const isDev = window.location.hostname === 'localhost' || 
                  window.location.hostname === '127.0.0.1' ||
                  window.location.hostname.includes('192.168') ||
                  process.env.NODE_ENV === "development";
    
    if (!isDev) {
      return;
    }

    const handleKeyPress = (e: KeyboardEvent) => {
      // Cmd/Ctrl + Shift + E = Toggle Error Panel
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "E") {
        e.preventDefault();
        setShowErrorPanel(prev => !prev);
      }

      // Cmd/Ctrl + Shift + D = Toggle Debug Info
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setShowDebugInfo(prev => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  return {
    showErrorPanel,
    showDebugInfo,
    setShowErrorPanel,
    setShowDebugInfo,
  };
}