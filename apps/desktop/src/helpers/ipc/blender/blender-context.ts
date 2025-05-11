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
    getStatus: () => ipcRenderer.invoke(BLENDER_STATUS_CHANNEL),
    // Add function to send messages *to* Blender via main process
    sendToBlender: (message: object) =>
      ipcRenderer.invoke(BLENDER_SEND_MESSAGE_CHANNEL, message),
    // Add function to execute code in Blender
    executeCode: (code: string) =>
      ipcRenderer.invoke(BLENDER_EXECUTE_CODE_CHANNEL, { code }),
    // Add function to get scene info from Blender
    getSceneInfo: () => ipcRenderer.invoke(BLENDER_GET_SCENE_INFO_CHANNEL, {}),
    // Add listener for Blender message responses (code execution results, scene info, etc.)
    onMessageResponse: (callback: (message: any) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, message: any) =>
        callback(message);
      ipcRenderer.on(BLENDER_MESSAGE_RESPONSE_CHANNEL, listener);

      // Return a cleanup function
      return () => {
        ipcRenderer.removeListener(BLENDER_MESSAGE_RESPONSE_CHANNEL, listener);
      };
    },
  });
}
