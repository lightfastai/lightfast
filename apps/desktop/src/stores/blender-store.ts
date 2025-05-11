import { create } from "zustand";

import type { BlenderConnectionStatus } from "../helpers/ipc/blender/blender-context";

interface BlenderState {
  connectionStatus: BlenderConnectionStatus;
  initializeListener: () => () => void; // Returns the cleanup function
  _cleanupListener: (() => void) | null;
}

export const useBlenderStore = create<BlenderState>((set, get) => ({
  // Default to disconnected instead of stopped to show a better UI indication
  connectionStatus: { status: "disconnected" },
  _cleanupListener: null,

  initializeListener: () => {
    // Avoid setting up multiple listeners
    if (get()._cleanupListener) {
      console.log(
        "Blender listener already initialized, reusing existing listener.",
      );
      return get()._cleanupListener!;
    }

    console.log("Initializing Blender status listener...");
    try {
      // Check if the blenderConnection API is available in the window object
      if (!window.blenderConnection) {
        console.error("BlenderConnection API not available in window object");
        set({
          connectionStatus: { status: "error", error: "API not available" },
        });
        return () => {};
      }

      // Set up the status listener
      const cleanup = window.blenderConnection.onStatusUpdate((status) => {
        console.log("Blender Status Update Received:", status);
        set({ connectionStatus: status });
      });

      set({ _cleanupListener: cleanup });
      return cleanup;
    } catch (error) {
      console.error("Error initializing Blender status listener:", error);
      set({
        connectionStatus: {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        },
      });
      return () => {};
    }
  },
}));
