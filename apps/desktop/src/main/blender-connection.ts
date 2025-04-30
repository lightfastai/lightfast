import type { WebContents } from "electron";
import { WebSocket, WebSocketServer } from "ws";

export const BLENDER_STATUS_CHANNEL = "blender-status-update";

export type BlenderConnectionStatus =
  | { status: "connected" }
  | { status: "disconnected" }
  | { status: "error"; error?: string }
  | { status: "listening" }
  | { status: "stopped" };

const BLENDER_PORT = 8765; // Or choose another port

let wss: WebSocketServer | null = null;
let blenderClient: WebSocket | null = null;
let electronWebContents: WebContents | null = null;

function sendStatusUpdate(status: BlenderConnectionStatus) {
  if (electronWebContents && !electronWebContents.isDestroyed()) {
    electronWebContents.send(BLENDER_STATUS_CHANNEL, status);
  }
}

export function startBlenderSocketServer(webContents: WebContents) {
  if (wss) {
    console.log("Blender WebSocket server already running.");
    return;
  }
  electronWebContents = webContents;

  try {
    wss = new WebSocketServer({ port: BLENDER_PORT });

    wss.on("listening", () => {
      console.log(`Blender WebSocket server listening on port ${BLENDER_PORT}`);
      sendStatusUpdate({ status: "listening" });
    });

    wss.on("connection", (ws: WebSocket) => {
      console.log("Blender client connected.");

      // For now, assume only one Blender client
      if (blenderClient) {
        console.log("Closing previous Blender connection.");
        blenderClient.terminate();
      }
      blenderClient = ws;
      sendStatusUpdate({ status: "connected" });

      ws.on("message", (message: Buffer) => {
        console.log("Received from Blender:", message.toString());
        // TODO: Handle incoming messages (parse JSON, use IPC to send to renderer)
        // Potentially send specific messages to renderer?
        // electronWebContents?.send('blender-message', parsedMessage);
      });

      ws.on("close", () => {
        console.log("Blender client disconnected.");
        if (blenderClient === ws) {
          blenderClient = null;
          sendStatusUpdate({ status: "disconnected" });
        }
      });

      ws.on("error", (error: Error) => {
        console.error("Blender client WebSocket error:", error);
        if (blenderClient === ws) {
          blenderClient = null;
          // Send error status only if this was the active client
          sendStatusUpdate({ status: "error", error: error.message });
        }
      });

      // Optional: Send a welcome message
      ws.send(JSON.stringify({ type: "connection_ack", status: "connected" }));
    });

    wss.on("error", (error: Error) => {
      console.error("Blender WebSocket server error:", error);
      const errorMessage =
        (error as NodeJS.ErrnoException).code === "EADDRINUSE"
          ? `Port ${BLENDER_PORT} already in use.`
          : error.message;
      sendStatusUpdate({ status: "error", error: errorMessage });
      wss = null; // Reset wss if server fails
    });
  } catch (error) {
    console.error("Failed to start Blender WebSocket server:", error);
    sendStatusUpdate({ status: "error", error: (error as Error).message });
    wss = null;
  }
}

export function stopBlenderSocketServer() {
  if (blenderClient) {
    blenderClient.close();
    blenderClient = null;
  }
  if (wss) {
    wss.close((err) => {
      if (err) {
        console.error("Error closing Blender WebSocket server:", err);
      } else {
        console.log("Blender WebSocket server stopped.");
      }
      wss = null;
      sendStatusUpdate({ status: "stopped" }); // Notify renderer
    });
  } else {
    // If server wasn't running, maybe still send stopped status?
    sendStatusUpdate({ status: "stopped" });
  }
}

// Function to send messages *to* Blender
export function sendToBlender(message: object) {
  if (blenderClient && blenderClient.readyState === WebSocket.OPEN) {
    try {
      blenderClient.send(JSON.stringify(message));
      console.log("Sent to Blender:", message);
    } catch (error) {
      console.error("Failed to send message to Blender:", error);
    }
  } else {
    console.warn("Cannot send message: Blender client not connected or ready.");
  }
}
