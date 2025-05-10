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
const HEARTBEAT_INTERVAL = 5000; // Check connection every 5 seconds

let wss: WebSocketServer | null = null;
let blenderClient: WebSocket | null = null;
let electronWebContents: WebContents | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

// Add more explicit type definitions for Blender messages
export interface BlenderRequestMessage {
  action: string;
  id: string;
  params: any;
}

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

// Map to store pending requests with explicit typing
const pendingRequests = new Map<
  string,
  {
    resolve: (value: BlenderResponseMessage) => void;
    reject: (reason: any) => void;
    action: string;
    timestamp: number;
  }
>();

function sendStatusUpdate(status: BlenderConnectionStatus) {
  if (electronWebContents && !electronWebContents.isDestroyed()) {
    electronWebContents.send(BLENDER_STATUS_CHANNEL, status);
  }
}

export function startBlenderSocketServer(webContents: WebContents) {
  console.log("🚀 Attempting to start Blender WebSocket server...");

  if (wss) {
    console.log("Blender WebSocket server already running.");
    // Send current status to any new renderer that connects
    if (blenderClient && blenderClient.readyState === WebSocket.OPEN) {
      sendStatusUpdate({ status: "connected" });
    } else {
      sendStatusUpdate({ status: "listening" });
    }
    return;
  }
  electronWebContents = webContents;

  try {
    console.log(`Creating WebSocket server on port ${BLENDER_PORT}...`);
    wss = new WebSocketServer({ port: BLENDER_PORT });
    console.log("WebSocket server created successfully");

    // Send initial status immediately after server is created
    sendStatusUpdate({ status: "listening" });

    wss.on("listening", () => {
      console.log(
        `✅ Blender WebSocket server listening on port ${BLENDER_PORT}`,
      );
      sendStatusUpdate({ status: "listening" });
    });

    wss.on("connection", (ws: WebSocket) => {
      console.log("🔌 Blender client connected.");

      // For now, assume only one Blender client
      if (blenderClient) {
        console.log("Closing previous Blender connection.");
        blenderClient.terminate();
      }
      blenderClient = ws;
      sendStatusUpdate({ status: "connected" });

      // Start heartbeat to check connection status
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      heartbeatInterval = setInterval(() => {
        if (
          ws.readyState === WebSocket.CLOSED ||
          ws.readyState === WebSocket.CLOSING
        ) {
          console.log("Heartbeat detected disconnected client");
          if (blenderClient === ws) {
            blenderClient = null;
            sendStatusUpdate({ status: "disconnected" });
          }
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }
        } else {
          // Send ping to check if client is still alive
          try {
            ws.ping();
          } catch (error) {
            console.error("Error sending ping:", error);
          }
        }
      }, HEARTBEAT_INTERVAL);

      ws.on("message", (message: Buffer) => {
        console.log(
          "Received from Blender:",
          message.toString().substring(0, 200) +
            (message.toString().length > 200 ? "..." : ""),
        );

        try {
          // Parse the message as JSON
          const parsedMessage = JSON.parse(
            message.toString(),
          ) as BlenderResponseMessage;

          // Check if this is a response to a pending request
          if (parsedMessage.id && pendingRequests.has(parsedMessage.id)) {
            const pendingRequest = pendingRequests.get(parsedMessage.id)!;
            const elapsedTime = Date.now() - pendingRequest.timestamp;

            console.log(
              `⭐ Resolving pending request (ID: ${parsedMessage.id}, action: ${pendingRequest.action}, elapsed: ${elapsedTime}ms)`,
            );
            console.log(`   Message type: ${parsedMessage.type}`);
            console.log(`   Success: ${parsedMessage.success}`);

            // Log some details about the response based on message type
            if (
              parsedMessage.type === "scene_info" &&
              parsedMessage.scene_info
            ) {
              console.log(
                `   Scene: ${parsedMessage.scene_info.name}, Objects: ${parsedMessage.scene_info.object_count}`,
              );
            } else if (parsedMessage.type === "code_executed") {
              if (parsedMessage.success) {
                console.log(
                  `   Output: ${(parsedMessage.output || "").substring(0, 50)}...`,
                );
              } else {
                console.log(`   Error: ${parsedMessage.error}`);
              }
            }

            const { resolve } = pendingRequest;
            pendingRequests.delete(parsedMessage.id);
            resolve(parsedMessage);
            console.log(
              `✅ Request resolved and removed from pending queue (${pendingRequests.size} remaining)`,
            );
          } else if (parsedMessage.id) {
            console.log(
              `⚠️ Received message with ID ${parsedMessage.id} but no matching pending request found`,
            );
            // Log the current pending request IDs for debugging
            console.log(
              `Current pending request IDs: ${Array.from(pendingRequests.keys()).join(", ")}`,
            );
          }

          // Check if this is the handshake message from Blender
          if (
            parsedMessage.type === "handshake" &&
            parsedMessage.client === "blender"
          ) {
            console.log("✅ Received handshake from Blender", parsedMessage);

            // Ensure the connection status is updated to "connected"
            sendStatusUpdate({ status: "connected" });

            // Send acknowledgment back to Blender
            ws.send(
              JSON.stringify({
                type: "handshake_response",
                status: "connected",
                message: "Connection established with Lightfast",
              }),
            );
          }

          // Check for disconnect message from Blender
          if (
            parsedMessage.type === "disconnect" &&
            parsedMessage.client === "blender"
          ) {
            console.log(
              "Received disconnect request from Blender",
              parsedMessage,
            );

            // Update status immediately
            if (blenderClient === ws) {
              sendStatusUpdate({ status: "disconnected" });
            }

            // Send acknowledgment
            try {
              ws.send(
                JSON.stringify({
                  type: "disconnect_ack",
                  status: "disconnecting",
                  message: "Disconnection acknowledged",
                }),
              );
            } catch (error) {
              console.error("Error sending disconnect acknowledgment:", error);
            }
          }

          // Handle other message types as needed
          // If not a handshake or disconnect, forward to renderer if it's a known type or all general messages
          else if (
            parsedMessage.type === "code_executed" ||
            parsedMessage.type === "scene_info"
          ) {
            if (electronWebContents && !electronWebContents.isDestroyed()) {
              // Add detailed logging for scene info responses
              if (parsedMessage.type === "scene_info") {
                console.log("🎬 Received Blender scene info:");
                console.log("- Message ID:", parsedMessage.id);
                console.log("- Success:", parsedMessage.success);
                if (parsedMessage.scene_info) {
                  console.log("- Scene name:", parsedMessage.scene_info.name);
                  console.log(
                    "- Object count:",
                    parsedMessage.scene_info.object_count,
                  );
                  console.log(
                    "- Materials count:",
                    parsedMessage.scene_info.materials_count,
                  );
                  console.log(
                    "- Objects list count:",
                    parsedMessage.scene_info.objects
                      ? parsedMessage.scene_info.objects.length
                      : 0,
                  );
                  console.log(
                    "- Full Scene Info:",
                    JSON.stringify(parsedMessage.scene_info, null, 2),
                  );
                } else {
                  console.log("- No scene info data provided");
                }
              } else if (parsedMessage.type === "code_executed") {
                console.log("💻 Received Blender code execution result:");
                console.log("- Message ID:", parsedMessage.id);
                console.log("- Success:", parsedMessage.success);
                if (parsedMessage.success) {
                  console.log("- Output:", parsedMessage.output);
                } else {
                  console.log("- Error:", parsedMessage.error);
                  console.log("- Error Type:", parsedMessage.error_type);
                  if (parsedMessage.traceback) {
                    console.log("- Traceback:", parsedMessage.traceback);
                  }
                }
              }

              console.log(
                "Forwarding message from Blender to renderer:",
                parsedMessage,
              );
              electronWebContents.send(
                "blender-message-response",
                parsedMessage,
              );
            }
          }
        } catch (error) {
          console.error("Error processing message from Blender:", error);
        }
      });

      ws.on("close", () => {
        console.log("Blender client disconnected.");
        if (blenderClient === ws) {
          blenderClient = null;
          sendStatusUpdate({ status: "disconnected" });
        }
      });

      ws.on("error", (error: Error) => {
        // Check if this is a protocol error during closing (can be ignored)
        if (
          error.message.includes("Invalid WebSocket frame") ||
          error.message.includes("MASK") ||
          error.message.includes("WebSocket is not open")
        ) {
          console.log(
            "WebSocket protocol error during close (expected):",
            error.message,
          );
        } else {
          // Log other errors
          console.error("Blender client WebSocket error:", error);
          if (blenderClient === ws) {
            blenderClient = null;
            // Send error status only if this was the active client
            sendStatusUpdate({ status: "error", error: error.message });
          }
        }
      });

      // Optional: Send a welcome message
      ws.send(JSON.stringify({ type: "connection_ack", status: "connected" }));
    });

    wss.on("error", (error: Error) => {
      console.error("❌ Blender WebSocket server error:", error);
      if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
        console.error(
          `Port ${BLENDER_PORT} is already in use. Try killing any process using this port.`,
        );
        console.error(
          `You can use 'lsof -i :${BLENDER_PORT}' to find processes using this port.`,
        );
      }
      const errorMessage =
        (error as NodeJS.ErrnoException).code === "EADDRINUSE"
          ? `Port ${BLENDER_PORT} already in use.`
          : error.message;
      sendStatusUpdate({ status: "error", error: errorMessage });
      wss = null; // Reset wss if server fails
    });
  } catch (error) {
    console.error("❌ Failed to start Blender WebSocket server:", error);
    console.error(`Stack trace: ${(error as Error).stack}`);
    sendStatusUpdate({ status: "error", error: (error as Error).message });
    wss = null;
  }
}

export function stopBlenderSocketServer() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

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

// Function to check if Blender is currently connected
export function isBlenderConnected(): boolean {
  return blenderClient !== null && blenderClient.readyState === WebSocket.OPEN;
}

// Function to get the current Blender connection status
export function getBlenderStatus(): BlenderConnectionStatus {
  if (blenderClient !== null && blenderClient.readyState === WebSocket.OPEN) {
    return { status: "connected" };
  } else if (wss !== null) {
    return { status: "listening" };
  } else {
    return { status: "disconnected" };
  }
}

// Function to get the WebSocketServer instance
export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}

// Function to send messages *to* Blender
export function sendToBlender(message: object) {
  if (isBlenderConnected()) {
    try {
      blenderClient!.send(JSON.stringify(message));
      console.log("Sent to Blender:", message);
    } catch (error) {
      console.error("Failed to send message to Blender:", error);
    }
  } else {
    console.warn("Cannot send message: Blender client not connected or ready.");
  }
}

// Function to send a request to Blender and wait for response
export async function requestFromBlender(
  action: string,
  params: any = {},
  timeoutMs: number = 10000, // Increased timeout for complex operations
): Promise<BlenderResponseMessage> {
  console.log(`📤 requestFromBlender: Starting request for action "${action}"`);
  console.log(`   Params: ${JSON.stringify(params).substring(0, 100)}`);
  console.log(`   Current pending requests: ${pendingRequests.size}`);

  return new Promise((resolve, reject) => {
    if (!isBlenderConnected()) {
      console.error("❌ requestFromBlender: Blender is not connected");
      return reject(new Error("Blender is not connected"));
    }

    // Generate a unique message ID with consistent format
    // Format: action_timestamp_random
    const timestamp = Date.now();
    const randomPart = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    const messageId = `${action}_${timestamp}_${randomPart}`;

    console.log(`🆔 requestFromBlender: Generated message ID: ${messageId}`);

    // Create message object with explicit typing
    const message: BlenderRequestMessage = {
      action,
      id: messageId,
      params,
    };

    // Store the promise resolvers with more metadata
    pendingRequests.set(messageId, {
      resolve,
      reject,
      action,
      timestamp: Date.now(),
    });

    console.log(
      `🗂️ requestFromBlender: Added to pending requests (now ${pendingRequests.size})`,
    );

    // Set timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      if (pendingRequests.has(messageId)) {
        console.error(
          `⏰ requestFromBlender: Request timed out for ID ${messageId} (action: ${action})`,
        );
        pendingRequests.delete(messageId);
        reject(
          new Error(
            `Request to Blender timed out after ${timeoutMs}ms. Action: ${action}`,
          ),
        );
      }
    }, timeoutMs);

    // Send the message
    try {
      blenderClient!.send(JSON.stringify(message));
      console.log(
        `📨 requestFromBlender: Message sent to Blender (ID: ${messageId}, action: ${action})`,
      );
    } catch (error) {
      console.error(`❌ requestFromBlender: Error sending message:`, error);
      clearTimeout(timeoutId);
      pendingRequests.delete(messageId);
      reject(error);
    }
  });
}
