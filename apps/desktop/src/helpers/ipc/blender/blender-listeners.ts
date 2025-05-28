import { BrowserWindow, ipcMain, WebContents } from "electron";

import {
  DEFAULT_BLENDER_PORT,
  getBlenderStatus,
  isBlenderConnected,
  requestFromBlender,
  sendToBlender,
  startBlenderSocketServer,
} from "../../../main/blender-connection";
import {
  BLENDER_EXECUTE_CODE_CHANNEL,
  BLENDER_GET_SCENE_INFO_CHANNEL,
  BLENDER_GET_SHADER_STATE_CHANNEL,
  BLENDER_SEND_MESSAGE_CHANNEL,
  BLENDER_STATUS_CHANNEL,
} from "./blender-channels";

// Track if we've already registered the global listeners
let blenderHandlersRegistered = false;

export function initializeBlenderConnection(
  contents: WebContents,
  port: number = DEFAULT_BLENDER_PORT,
) {
  startBlenderSocketServer(contents, port);
  console.log(`Blender WebSocket server initialized on port ${port}`);
}

export function addBlenderEventListeners() {
  // Only register handlers once
  if (blenderHandlersRegistered) {
    console.log("Blender event listeners already registered, skipping");
    return;
  }

  console.log("Registering Blender event listeners");

  // Add handler for getting Blender status
  ipcMain.handle(BLENDER_STATUS_CHANNEL, (event) => {
    // Get the window's ID to find its port
    const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
    let port = DEFAULT_BLENDER_PORT;

    // If we have the window, get its assigned port
    if (windowId && global.windowPortMap) {
      const windowPort = global.windowPortMap.get(windowId);
      if (windowPort) {
        port = windowPort;
      }
    }

    // Return the current Blender connection status using the imported function
    return getBlenderStatus(port);
  });

  // Add handler for sending messages to Blender
  ipcMain.handle(BLENDER_SEND_MESSAGE_CHANNEL, async (event, message) => {
    try {
      const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
      let port = DEFAULT_BLENDER_PORT;

      if (windowId && global.windowPortMap) {
        const windowPort = global.windowPortMap.get(windowId);
        if (windowPort) {
          port = windowPort;
        }
      }

      console.log(`Main: Sending message to Blender on port ${port}:`, message);

      // Check if Blender is connected
      if (!isBlenderConnected(port)) {
        console.warn(
          `Main: Blender is not connected on port ${port}. Cannot send message.`,
        );
        return {
          success: false,
          error: `Blender is not connected on port ${port}. Please check your Blender connection.`,
          errorCode: "BLENDER_NOT_CONNECTED",
        };
      }

      // Send the message to Blender
      sendToBlender(message, port);

      return {
        success: true,
        message: `Message sent to Blender on port ${port}`,
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
      const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
      let port = DEFAULT_BLENDER_PORT;

      if (windowId && global.windowPortMap) {
        const windowPort = global.windowPortMap.get(windowId);
        if (windowPort) {
          port = windowPort;
        }
      }

      console.log(
        `Main: Received request to execute code in Blender on port ${port}`,
      );

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
      if (!isBlenderConnected(port)) {
        console.warn(
          `Main: Blender is not connected on port ${port}. Cannot execute code.`,
        );
        return {
          success: false,
          error: `Blender is not connected on port ${port}. Please check your Blender connection.`,
          errorCode: "BLENDER_NOT_CONNECTED",
        };
      }

      try {
        // Send the request and wait for response
        console.log(
          `Main: Sending execute_code request to Blender on port ${port} and waiting for response...`,
        );
        const response = await requestFromBlender(
          "execute_code",
          { code },
          port,
        );
        console.log(
          `Main: Received execute_code response from Blender on port ${port}:`,
          JSON.stringify(response).substring(0, 200),
        );
        console.log(
          `Main: Response details - type: ${response.type}, id: ${response.id}, success: ${response.success}`,
        );

        // Return the response directly to the renderer
        console.log(
          `Main: Returning execute_code response from port ${port} to renderer`,
        );
        return response;
      } catch (error: any) {
        console.error(
          `Main: Error during Blender code execution on port ${port}:`,
          error,
        );
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
      const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
      let port = DEFAULT_BLENDER_PORT;

      if (windowId && global.windowPortMap) {
        const windowPort = global.windowPortMap.get(windowId);
        if (windowPort) {
          port = windowPort;
        }
      }

      console.log(
        `Main: Received request to get Blender scene info from port ${port}`,
      );

      // Check if Blender is connected before attempting to send the command
      if (!isBlenderConnected(port)) {
        console.warn(
          `Main: Blender is not connected on port ${port}. Cannot get scene info.`,
        );
        return {
          success: false,
          error: `Blender is not connected on port ${port}. Please check your Blender connection.`,
          errorCode: "BLENDER_NOT_CONNECTED",
        };
      }

      try {
        // Send the request and wait for response
        console.log(
          `Main: Sending get_scene_info request to Blender on port ${port} and waiting for response...`,
        );
        const response = await requestFromBlender("get_scene_info", {}, port);
        console.log(
          `Main: Received scene_info response from Blender on port ${port}:`,
          JSON.stringify(response).substring(0, 200),
        );
        console.log(
          `Main: Response details - type: ${response.type}, id: ${response.id}, success: ${response.success}`,
        );
        if (response.scene_info) {
          console.log(
            `Main: Scene info from port ${port} - name: ${response.scene_info.name}, objects: ${response.scene_info.object_count}`,
          );
        }

        // Return the response directly to the renderer
        console.log(
          `Main: Returning scene_info response from port ${port} to renderer`,
        );
        return response;
      } catch (error: any) {
        console.error(
          `Main: Error getting scene info from Blender on port ${port}:`,
          error,
        );
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

  // Add Blender get shader state handler
  ipcMain.handle(BLENDER_GET_SHADER_STATE_CHANNEL, async (event, args) => {
    try {
      const windowId = BrowserWindow.fromWebContents(event.sender)?.id;
      let port = DEFAULT_BLENDER_PORT;

      if (windowId && global.windowPortMap) {
        const windowPort = global.windowPortMap.get(windowId);
        if (windowPort) {
          port = windowPort;
        }
      }

      console.log(
        `Main: Received request to get Blender shader state from port ${port}`,
      );

      // Check if Blender is connected before attempting to send the command
      if (!isBlenderConnected(port)) {
        console.warn(
          `Main: Blender is not connected on port ${port}. Cannot get shader state.`,
        );
        return {
          success: false,
          error: `Blender is not connected on port ${port}. Please check your Blender connection.`,
          errorCode: "BLENDER_NOT_CONNECTED",
        };
      }

      try {
        // Send the request and wait for response
        console.log(
          `Main: Sending get_shader_state request to Blender on port ${port} and waiting for response...`,
        );
        const response = await requestFromBlender("get_shader_state", {}, port);
        console.log(
          `Main: Received shader_info response from Blender on port ${port}:`,
          JSON.stringify(response).substring(0, 200),
        );
        console.log(
          `Main: Response details - type: ${response.type}, id: ${response.id}, success: ${response.success}`,
        );
        if (response.shader_info) {
          console.log(
            `Main: Shader info from port ${port} - materials: ${response.shader_info.materials_count}, node groups: ${response.shader_info.node_groups_count}`,
          );
        }

        // Return the response directly to the renderer
        console.log(
          `Main: Returning shader_info response from port ${port} to renderer`,
        );
        return response;
      } catch (error: any) {
        console.error(
          `Main: Error getting shader state from Blender on port ${port}:`,
          error,
        );
        return {
          success: false,
          error: error.message,
          errorCode: "EXECUTION_ERROR",
        };
      }
    } catch (error: any) {
      console.error("Main: Error handling Blender get shader state:", error);
      return {
        success: false,
        error: `Failed to get Blender shader state: ${error.message}`,
        errorCode: "EXECUTION_ERROR",
      };
    }
  });

  // Mark as registered
  blenderHandlersRegistered = true;
}
