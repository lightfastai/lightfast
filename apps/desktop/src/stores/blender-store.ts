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
  connectionStatus: { status: "stopped" }, // Initial state
  _cleanupListener: null,

  initializeListener: () => {
    // Avoid setting up multiple listeners
    if (get()._cleanupListener) {
      console.warn("Blender listener already initialized.");
      return get()._cleanupListener!;
    }

    console.log("Initializing Blender status listener...");
    const cleanup = window.blenderConnection.onStatusUpdate((status) => {
      console.log("Blender Status Update Received:", status);
      set({ connectionStatus: status });
    });

    set({ _cleanupListener: cleanup });
    return cleanup;
  },

  sendMessage: async (message: object) => {
    try {
      await window.blenderConnection.sendToBlender(message);
    } catch (error) {
      console.error("Error sending message to Blender via IPC:", error);
      // Optionally update state to reflect send error
    }
  },
}));

// Initialize the listener once when the store is loaded/used.
// This approach ensures it's called early.
// Alternatively, call this explicitly from a top-level component's useEffect.
// const cleanup = useBlenderStore.getState().initializeListener();
// Consider potential race conditions or timing issues with this approach.
// A useEffect in App.tsx might be safer.
