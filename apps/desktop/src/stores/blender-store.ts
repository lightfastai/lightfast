import { create } from "zustand";

// Re-define status type or import if possible via shared package later
export type BlenderConnectionStatus =
  | { status: "connected" }
  | { status: "disconnected" }
  | { status: "error"; error?: string }
  | { status: "listening" }
  | { status: "stopped" };

// Define types for Blender state data
export interface BlenderStateData {
  mode?: string;
  active_object?: {
    name: string;
    type: string | null;
    location: number[] | null;
    dimensions: number[] | null;
  } | null;
  selected_objects?: Array<{
    name: string;
    type: string;
  }>;
  scene?: {
    name: string;
    frame_current: number;
    frame_start: number;
    frame_end: number;
  };
  viewport?: {
    shading_type: string;
    show_floor: boolean;
    show_axis_x: boolean;
    show_axis_y: boolean;
    show_axis_z: boolean;
  };
}

// Define type for code execution results
export interface CodeExecutionResult {
  id: string;
  type: string;
  success: boolean;
  output?: string;
  error?: string;
  error_type?: string;
  traceback?: string;
  partial_output?: string;
}

interface BlenderState {
  connectionStatus: BlenderConnectionStatus;
  blenderState: BlenderStateData | null;
  lastCodeExecution: CodeExecutionResult | null;
  messageListenerActive: boolean;

  initializeListener: () => () => void; // Returns the cleanup function
  initializeMessageListener: () => () => void; // Returns the cleanup function
  sendMessage: (message: object) => Promise<void>;
  executeCode: (code: string) => Promise<void>;
  getState: () => Promise<void>;
  updateBlenderState: (state: BlenderStateData) => void;
  updateCodeExecutionResult: (result: CodeExecutionResult) => void;
  _cleanupListener: (() => void) | null;
  _cleanupMessageListener: (() => void) | null;
}

export const useBlenderStore = create<BlenderState>((set, get) => ({
  // Default to disconnected instead of stopped to show a better UI indication
  connectionStatus: { status: "disconnected" },
  blenderState: null,
  lastCodeExecution: null,
  messageListenerActive: false,
  _cleanupListener: null,
  _cleanupMessageListener: null,

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

  initializeMessageListener: () => {
    // Avoid setting up multiple listeners
    if (get()._cleanupMessageListener) {
      console.warn("Blender message listener already initialized.");
      return get()._cleanupMessageListener!;
    }

    console.log("Initializing Blender message listener...");
    try {
      // Check if the blenderConnection API is available in the window object
      if (
        !window.blenderConnection ||
        !window.blenderConnection.onMessageResponse
      ) {
        console.error("BlenderConnection message API not available");
        set({
          connectionStatus: {
            status: "error",
            error: "Message API not available",
          },
        });
        return () => {};
      }

      // Set up the message listener
      const cleanup = window.blenderConnection.onMessageResponse((message) => {
        console.log("Blender Message Received:", message);

        // Handle different message types
        if (message.type === "blender_state" && message.state) {
          console.log("📊 Renderer: Processing Blender state data");
          console.log("- Message ID:", message.id);
          console.log("- Mode:", message.state.mode);
          console.log(
            "- Active Object:",
            message.state.active_object?.name || "None",
          );
          console.log(
            "- Selected Objects:",
            message.state.selected_objects?.length || 0,
          );
          console.log("- Scene:", message.state.scene?.name || "None");

          get().updateBlenderState(message.state);
          console.log("✅ State data stored in Blender Store");
        } else if (message.type === "code_executed") {
          console.log("💻 Renderer: Processing code execution result");
          console.log("- Success:", message.success);
          console.log(
            "- Output/Error:",
            message.success ? message.output : message.error,
          );

          get().updateCodeExecutionResult(message);
          console.log("✅ Code execution result stored in Blender Store");
        }
      });

      set({
        _cleanupMessageListener: cleanup,
        messageListenerActive: true,
      });
      return cleanup;
    } catch (error) {
      console.error("Error initializing Blender message listener:", error);
      set({
        connectionStatus: {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        },
      });
      return () => {};
    }
  },

  updateBlenderState: (state) => {
    set({ blenderState: state });
    console.log("Blender state updated:", state);
  },

  updateCodeExecutionResult: (result) => {
    set({ lastCodeExecution: result });
    console.log("Code execution result updated:", result);
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

  executeCode: async (code: string) => {
    try {
      if (!window.blenderConnection) {
        throw new Error("BlenderConnection API not available");
      }
      await window.blenderConnection.executeCode(code);
    } catch (error) {
      console.error("Error executing code in Blender via IPC:", error);
      // Update state to reflect execute error
      set({
        connectionStatus: {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  },

  getState: async () => {
    try {
      if (!window.blenderConnection) {
        throw new Error("BlenderConnection API not available");
      }
      // Ensure we have a message listener active before requesting state
      if (!get().messageListenerActive) {
        get().initializeMessageListener();
      }
      await window.blenderConnection.getState();
    } catch (error) {
      console.error("Error getting state from Blender via IPC:", error);
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
