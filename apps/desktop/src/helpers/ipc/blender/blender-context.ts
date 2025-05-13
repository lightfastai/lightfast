import { contextBridge, ipcRenderer } from "electron";

import {
  BLENDER_EXECUTE_CODE_CHANNEL,
  BLENDER_GET_SCENE_INFO_CHANNEL,
  BLENDER_MESSAGE_RESPONSE_CHANNEL,
  BLENDER_SEND_MESSAGE_CHANNEL,
  BLENDER_STATUS_CHANNEL,
  BLENDER_STATUS_UPDATE_CHANNEL,
} from "./blender-channels";

// Define the BlenderConnectionStatus type
export type BlenderConnectionStatus =
  | { status: "connected" }
  | { status: "disconnected" }
  | { status: "error"; error?: string }
  | { status: "listening" }
  | { status: "stopped" };

// Define Blender response message types to match the main process
export interface BlenderResponseMessage {
  type: string;
  id: string;
  success: boolean;
  output?: string;
  error?: string;
  error_type?: string;
  traceback?: string;
  scene_info?: any;
  client?: string;
}

// Define code execution and scene info response types
export interface BlenderCodeExecutionResponse extends BlenderResponseMessage {
  type: "code_executed";
  output?: string;
}

export interface BlenderSceneInfoResponse extends BlenderResponseMessage {
  type: "scene_info";
  scene_info: {
    name: string;
    object_count: number;
    materials_count: number;
    objects?: Array<{ name: string; type: string }>;
    [key: string]: any;
  };
}

export function exposeBlenderContext() {
  // Expose Blender connection API
  contextBridge.exposeInMainWorld("blenderConnection", {
    onStatusUpdate: (callback: (status: BlenderConnectionStatus) => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        status: BlenderConnectionStatus,
      ) => callback(status);
      ipcRenderer.on(BLENDER_STATUS_UPDATE_CHANNEL, listener);

      // Return a cleanup function
      return () => {
        ipcRenderer.removeListener(BLENDER_STATUS_UPDATE_CHANNEL, listener);
      };
    },
    // Add function to get current Blender status
    getStatus: (): Promise<BlenderConnectionStatus> =>
      ipcRenderer.invoke(BLENDER_STATUS_CHANNEL),

    // Get the assigned Blender port for this window
    getPort: (): Promise<number> => ipcRenderer.invoke("get-blender-port"),

    // Set the port for the Blender connection
    setPort: (port: number): Promise<boolean> =>
      ipcRenderer.invoke("set-blender-port", port),

    // Add function to send messages *to* Blender via main process
    sendToBlender: (
      message: object,
    ): Promise<{ success: boolean; message?: string; error?: string }> =>
      ipcRenderer.invoke(BLENDER_SEND_MESSAGE_CHANNEL, message),

    // Add function to execute code in Blender
    executeCode: (code: string): Promise<BlenderCodeExecutionResponse> =>
      ipcRenderer.invoke(BLENDER_EXECUTE_CODE_CHANNEL, { code }),

    // Add function to get scene info from Blender
    getSceneInfo: (): Promise<BlenderSceneInfoResponse> =>
      ipcRenderer.invoke(BLENDER_GET_SCENE_INFO_CHANNEL, {}),

    // Add listener for Blender message responses
    onMessageResponse: (
      callback: (message: BlenderResponseMessage) => void,
    ) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        message: BlenderResponseMessage,
      ) => callback(message);
      ipcRenderer.on(BLENDER_MESSAGE_RESPONSE_CHANNEL, listener);

      // Return a cleanup function
      return () => {
        ipcRenderer.removeListener(BLENDER_MESSAGE_RESPONSE_CHANNEL, listener);
      };
    },
  });
}
