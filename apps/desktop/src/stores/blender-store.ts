import { create } from "zustand";

// Re-define status type or import if possible via shared package later
export type BlenderConnectionStatus =
  | { status: "connected" }
  | { status: "disconnected" }
  | { status: "error"; error?: string }
  | { status: "listening" }
  | { status: "stopped" };

interface BlenderState {
  connectionStatus: BlenderConnectionStatus;
  initializeListener: () => () => void; // Returns the cleanup function
  sendMessage: (message: object) => Promise<void>;
  _cleanupListener: (() => void) | null;
}

export const useBlenderStore = create<BlenderState>((set, get) => ({
  // Default to disconnected instead of stopped to show a better UI indication
  connectionStatus: { status: "disconnected" },
  _cleanupListener: null,

  initializeListener: () => {
    // Avoid setting up multiple listeners
    if (get()._cleanupListener) {
      console.warn("Blender listener already initialized.");
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

      // Request the current status via IPC - if possible with your main process code
      // This could be added as a method to the window.blenderConnection API

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

  sendMessage: async (message: object) => {
    try {
      if (!window.blenderConnection) {
        throw new Error("BlenderConnection API not available");
      }
      await window.blenderConnection.sendToBlender(message);
    } catch (error) {
      console.error("Error sending message to Blender via IPC:", error);
      // Update state to reflect send error
      set({
        connectionStatus: {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  },
}));

// Initialize the listener once when the store is loaded/used.
// This approach ensures it's called early.
// Alternatively, call this explicitly from a top-level component's useEffect.
// const cleanup = useBlenderStore.getState().initializeListener();
// Consider potential race conditions or timing issues with this approach.
// A useEffect in App.tsx might be safer.
