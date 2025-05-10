import { create } from "zustand";

import type {
  BlenderCodeExecutionResponse,
  BlenderConnectionStatus,
  BlenderResponseMessage,
  BlenderSceneInfoResponse,
} from "../helpers/ipc/blender/blender-context";

// Define types for Blender scene info data
export interface BlenderSceneInfoData {
  name: string;
  object_count: number;
  objects: Array<{
    name: string;
    type: string;
    location: number[];
  }>;
  materials_count: number;
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
  blenderSceneInfo: BlenderSceneInfoData | null; // Scene info format
  lastCodeExecution: CodeExecutionResult | null;
  messageListenerActive: boolean;
  isExecutingCode: boolean; // Track if code execution is in progress
  isGettingSceneInfo: boolean; // Track if scene info request is in progress

  initializeListener: () => () => void; // Returns the cleanup function
  initializeMessageListener: () => () => void; // Returns the cleanup function
  sendMessage: (message: object) => Promise<void>;
  executeCode: (code: string) => Promise<BlenderCodeExecutionResponse>;
  getSceneInfo: () => Promise<BlenderSceneInfoResponse>; // Return the promise result
  updateBlenderSceneInfo: (sceneInfo: BlenderSceneInfoData) => void;
  updateCodeExecutionResult: (result: CodeExecutionResult) => void;
  _cleanupListener: (() => void) | null;
  _cleanupMessageListener: (() => void) | null;
}

export const useBlenderStore = create<BlenderState>((set, get) => ({
  // Default to disconnected instead of stopped to show a better UI indication
  connectionStatus: { status: "disconnected" },
  blenderState: null,
  blenderSceneInfo: null,
  lastCodeExecution: null,
  messageListenerActive: false,
  isExecutingCode: false,
  isGettingSceneInfo: false,
  _cleanupListener: null,
  _cleanupMessageListener: null,

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

  initializeMessageListener: () => {
    // Avoid setting up multiple listeners
    if (get()._cleanupMessageListener) {
      console.log(
        "Blender message listener already initialized, reusing existing listener.",
      );
      return get()._cleanupMessageListener!;
    }

    console.log("📱 Store: Initializing Blender message listener...");
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
      const cleanup = window.blenderConnection.onMessageResponse(
        (message: BlenderResponseMessage) => {
          console.log("📱 Store: Blender Message Received:", message);

          if (message.type === "scene_info" && message.scene_info) {
            console.log("🎬 Store: Processing Blender scene info data");
            console.log("- Message ID:", message.id);
            console.log("- Success:", message.success);
            console.log("- Scene Name:", message.scene_info.name);
            console.log("- Object Count:", message.scene_info.object_count);
            console.log(
              "- Materials Count:",
              message.scene_info.materials_count,
            );
            console.log(
              "- Objects List:",
              message.scene_info.objects?.length || 0,
            );

            get().updateBlenderSceneInfo(message.scene_info);
            console.log("✅ Store: Scene info data stored in Blender Store");
          } else if (message.type === "code_executed") {
            console.log("💻 Store: Processing code execution result");
            console.log("- Success:", message.success);
            console.log(
              "- Output/Error:",
              message.success ? message.output : message.error,
            );

            get().updateCodeExecutionResult(message);
            console.log(
              "✅ Store: Code execution result stored in Blender Store",
            );
          }
        },
      );

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

  updateBlenderSceneInfo: (sceneInfo) => {
    console.log("🔄 Store: Updating Blender scene info in store...");
    console.log(`   Scene: ${sceneInfo.name}`);
    console.log(`   Objects: ${sceneInfo.object_count}`);
    console.log(`   Materials: ${sceneInfo.materials_count}`);

    set({
      blenderSceneInfo: sceneInfo,
      isGettingSceneInfo: false, // Reset the flag when we receive the data
    });

    console.log("✅ Store: Blender scene info updated in store");
  },

  updateCodeExecutionResult: (result) => {
    console.log("🔄 Store: Updating code execution result in store...");
    console.log(`   ID: ${result.id}`);
    console.log(`   Success: ${result.success}`);
    if (result.success) {
      const output = result.output || "";
      console.log(
        `   Output: ${output.substring(0, 100)}${output.length > 100 ? "..." : ""}`,
      );
    } else {
      console.log(`   Error: ${result.error}`);
      if (result.error_type) {
        console.log(`   Error type: ${result.error_type}`);
      }
    }

    set({
      lastCodeExecution: result,
      isExecutingCode: false, // Reset the flag when we receive the result
    });

    console.log("✅ Store: Code execution result updated in store");
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

      // Ensure we have a message listener active before executing code
      if (!get().messageListenerActive) {
        get().initializeMessageListener();
      }

      // Set the executing flag
      set({ isExecutingCode: true });

      console.log("💻 Store: Executing code in Blender...");
      // Use the direct response from the API
      const response = await window.blenderConnection.executeCode(code);
      console.log(
        "📱 Store: Received direct code execution response:",
        response,
      );

      // Update store with the result
      get().updateCodeExecutionResult(response);

      return response;
    } catch (error) {
      console.error("Error executing code in Blender via IPC:", error);

      // Reset the executing flag
      set({ isExecutingCode: false });

      // Update state to reflect execute error
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({
        connectionStatus: {
          status: "error",
          error: errorMsg,
        },
        lastCodeExecution: {
          id: `error_${Date.now()}`,
          type: "code_executed",
          success: false,
          error: errorMsg,
        },
      });

      // Return error response
      throw error;
    }
  },

  getSceneInfo: async () => {
    try {
      if (!window.blenderConnection) {
        throw new Error("BlenderConnection API not available");
      }

      // Ensure we have a message listener active before requesting scene info
      if (!get().messageListenerActive) {
        get().initializeMessageListener();
      }

      // Set the flag
      set({ isGettingSceneInfo: true });

      console.log("🔍 Store: Requesting scene info from Blender");
      // Use the direct response from the API
      const response = await window.blenderConnection.getSceneInfo();
      console.log("📱 Store: Received direct scene info response:", response);

      // Update store with the result
      if (response.scene_info) {
        get().updateBlenderSceneInfo(response.scene_info);
      }

      return response;
    } catch (error) {
      console.error("Error getting scene info from Blender via IPC:", error);

      // Reset the flag
      set({ isGettingSceneInfo: false });

      // Update state to reflect error
      set({
        connectionStatus: {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        },
      });

      // Return error response
      throw error;
    }
  },
}));
