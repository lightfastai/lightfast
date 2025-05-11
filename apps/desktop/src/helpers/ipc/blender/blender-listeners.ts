import { ipcMain, WebContents } from "electron";

import {
  getBlenderStatus,
  isBlenderConnected,
  requestFromBlender,
  sendToBlender,
  startBlenderSocketServer,
} from "../../../main/blender-connection";
import {
  BLENDER_EXECUTE_CODE_CHANNEL,
  BLENDER_GET_SCENE_INFO_CHANNEL,
  BLENDER_SEND_MESSAGE_CHANNEL,
  BLENDER_STATUS_CHANNEL,
} from "./blender-channels";

export function initializeBlenderConnection(contents: WebContents) {
  startBlenderSocketServer(contents);
  console.log("Blender WebSocket server initialized");
}

export function addBlenderEventListeners() {
  // Add handler for getting Blender status
  ipcMain.handle(BLENDER_STATUS_CHANNEL, () => {
    // Return the current Blender connection status using the imported function
    return getBlenderStatus();
  });

  // Add handler for sending messages to Blender
  ipcMain.handle(BLENDER_SEND_MESSAGE_CHANNEL, async (event, message) => {
    try {
      console.log("Main: Sending message to Blender:", message);

      // Check if Blender is connected
      if (!isBlenderConnected()) {
        console.warn("Main: Blender is not connected. Cannot send message.");
        return {
          success: false,
          error:
            "Blender is not connected. Please check your Blender connection.",
          errorCode: "BLENDER_NOT_CONNECTED",
        };
      }

      // Send the message to Blender
      sendToBlender(message);

      return {
        success: true,
        message: "Message sent to Blender",
      };
    } catch (error: any) {
      console.error("Main: Error sending message to Blender:", error);
      return {
        success: false,
        error: `Failed to send message to Blender: ${error.message}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  });

  // Add Blender execute code handler
  ipcMain.handle(BLENDER_EXECUTE_CODE_CHANNEL, async (event, args) => {
    try {
      console.log("Main: Received request to execute code in Blender");

      // Extract code from args
      const { code } = args;

      if (!code) {
        console.warn("Main: No code provided for execution");
        return {
          success: false,
          error: "No code provided for execution",
          errorCode: "INVALID_CODE",
        };
      }

      // Check if Blender is connected before attempting to send the command
      if (!isBlenderConnected()) {
        console.warn("Main: Blender is not connected. Cannot execute code.");
        return {
          success: false,
          error:
            "Blender is not connected. Please check your Blender connection.",
          errorCode: "BLENDER_NOT_CONNECTED",
        };
      }

      try {
        // Send the request and wait for response
        console.log(
          "Main: Sending execute_code request to Blender and waiting for response...",
        );
        const response = await requestFromBlender("execute_code", { code });
        console.log(
          "Main: Received execute_code response from Blender:",
          JSON.stringify(response).substring(0, 200),
        );
        console.log(
          `Main: Response details - type: ${response.type}, id: ${response.id}, success: ${response.success}`,
        );

        // Return the response directly to the renderer
        console.log("Main: Returning execute_code response to renderer");
        return response;
      } catch (error: any) {
        console.error("Main: Error during Blender code execution:", error);
        return {
          success: false,
          error: error.message,
          errorCode: "EXECUTION_ERROR",
        };
      }
    } catch (error: any) {
      console.error("Main: Error handling Blender code execution:", error);
      return {
        success: false,
        error: `Failed to execute code in Blender: ${error.message}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  });

  // Add Blender get scene info handler
  ipcMain.handle(BLENDER_GET_SCENE_INFO_CHANNEL, async (event, args) => {
    try {
      console.log("Main: Received request to get Blender scene info");

      // Check if Blender is connected before attempting to send the command
      if (!isBlenderConnected()) {
        console.warn("Main: Blender is not connected. Cannot get scene info.");
        return {
          success: false,
          error:
            "Blender is not connected. Please check your Blender connection.",
          errorCode: "BLENDER_NOT_CONNECTED",
        };
      }

      try {
        // Send the request and wait for response
        console.log(
          "Main: Sending get_scene_info request to Blender and waiting for response...",
        );
        const response = await requestFromBlender("get_scene_info", {});
        console.log(
          "Main: Received scene_info response from Blender:",
          JSON.stringify(response).substring(0, 200),
        );
        console.log(
          `Main: Response details - type: ${response.type}, id: ${response.id}, success: ${response.success}`,
        );
        if (response.scene_info) {
          console.log(
            `Main: Scene info - name: ${response.scene_info.name}, objects: ${response.scene_info.object_count}`,
          );
        }

        // Return the response directly to the renderer
        console.log("Main: Returning scene_info response to renderer");
        return response;
      } catch (error: any) {
        console.error("Main: Error getting scene info from Blender:", error);
        return {
          success: false,
          error: error.message,
          errorCode: "EXECUTION_ERROR",
        };
      }
    } catch (error: any) {
      console.error("Main: Error handling Blender get scene info:", error);
      return {
        success: false,
        error: `Failed to get Blender scene info: ${error.message}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  });
}
