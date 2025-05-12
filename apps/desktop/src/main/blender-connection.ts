import type { WebContents } from "electron";
import { WebSocket, WebSocketServer } from "ws";

export const BLENDER_STATUS_CHANNEL = "blender-status-update";

export type BlenderConnectionStatus =
  | { status: "connected" }
  | { status: "disconnected" }
  | { status: "error"; error?: string }
  | { status: "listening" }
  | { status: "stopped" };

export const DEFAULT_BLENDER_PORT = 8765; // Default port
// Store active ports to track which ones are in use
const activePorts = new Map<number, WebSocketServer>();
const HEARTBEAT_INTERVAL = 5000; // Check connection every 5 seconds

// Track clients by port number
const blenderClients = new Map<
  number,
  {
    client: WebSocket;
    webContents: WebContents;
    heartbeatInterval: NodeJS.Timeout | null;
    pendingRequests: Map<
      string,
      {
        resolve: (value: BlenderResponseMessage) => void;
        reject: (reason: any) => void;
        action: string;
        timestamp: number;
      }
    >;
  }
>();

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

function sendStatusUpdate(port: number, status: BlenderConnectionStatus) {
  const portData = blenderClients.get(port);
  if (portData && portData.webContents && !portData.webContents.isDestroyed()) {
    portData.webContents.send(BLENDER_STATUS_CHANNEL, status);
  }
}

export function startBlenderSocketServer(
  webContents: WebContents,
  port: number = DEFAULT_BLENDER_PORT,
) {
  console.log(
    `🚀 Attempting to start Blender WebSocket server on port ${port}...`,
  );

  // First, check if we need to clean up an existing server on this port
  if (activePorts.has(port)) {
    const existingWss = activePorts.get(port)!;

    // If we have a client for this port
    const portData = blenderClients.get(port);

    // If we're requesting the same port with the same web contents,
    // there's no need to restart the server
    if (portData && portData.webContents === webContents) {
      console.log(
        `Blender WebSocket server already running on port ${port} with same web contents.`,
      );

      // Update status just in case
      if (portData.client && portData.client.readyState === WebSocket.OPEN) {
        sendStatusUpdate(port, { status: "connected" });
      } else {
        sendStatusUpdate(port, { status: "listening" });
      }
      return;
    }

    // Otherwise, we'll close the existing server and create a new one
    console.log(
      `Closing existing WebSocket server on port ${port} to reinitialize with new web contents.`,
    );
    closeServerOnPort(port, existingWss);
    activePorts.delete(port);
    blenderClients.delete(port);
  }

  try {
    console.log(`Creating WebSocket server on port ${port}...`);
    const wss = new WebSocketServer({ port });
    console.log("WebSocket server created successfully");

    // Store in active ports map
    activePorts.set(port, wss);

    // Initialize port data with empty pendingRequests
    blenderClients.set(port, {
      client: null as unknown as WebSocket,
      webContents,
      heartbeatInterval: null,
      pendingRequests: new Map(),
    });

    // Send initial status immediately after server is created
    sendStatusUpdate(port, { status: "listening" });

    wss.on("listening", () => {
      console.log(`✅ Blender WebSocket server listening on port ${port}`);
      sendStatusUpdate(port, { status: "listening" });
    });

    wss.on("connection", (ws: WebSocket) => {
      console.log(`🔌 Blender client connected on port ${port}.`);

      // Get port data
      const portData = blenderClients.get(port);
      if (!portData) {
        console.error(`No port data found for port ${port}`);
        return;
      }

      // If we already have a client for this port, close it
      if (portData.client && portData.client.readyState === WebSocket.OPEN) {
        console.log(`Closing previous Blender connection on port ${port}.`);
        portData.client.terminate();
      }

      // Update client reference
      portData.client = ws;
      sendStatusUpdate(port, { status: "connected" });

      // Start heartbeat to check connection status
      if (portData.heartbeatInterval) {
        clearInterval(portData.heartbeatInterval);
      }

      portData.heartbeatInterval = setInterval(() => {
        if (
          ws.readyState === WebSocket.CLOSED ||
          ws.readyState === WebSocket.CLOSING
        ) {
          console.log(`Heartbeat detected disconnected client on port ${port}`);
          if (portData.client === ws) {
            portData.client = null as unknown as WebSocket;
            sendStatusUpdate(port, { status: "disconnected" });
          }
          if (portData.heartbeatInterval) {
            clearInterval(portData.heartbeatInterval);
            portData.heartbeatInterval = null;
          }
        } else {
          // Send ping to check if client is still alive
          try {
            ws.ping();
          } catch (error) {
            console.error(`Error sending ping on port ${port}:`, error);
          }
        }
      }, HEARTBEAT_INTERVAL);

      ws.on("message", (message: Buffer) => {
        console.log(
          `Received from Blender on port ${port}:`,
          message.toString().substring(0, 200) +
            (message.toString().length > 200 ? "..." : ""),
        );

        try {
          // Parse the message as JSON
          const parsedMessage = JSON.parse(
            message.toString(),
          ) as BlenderResponseMessage;

          // Check if this is a response to a pending request
          if (
            parsedMessage.id &&
            portData.pendingRequests.has(parsedMessage.id)
          ) {
            const pendingRequest = portData.pendingRequests.get(
              parsedMessage.id,
            )!;
            const elapsedTime = Date.now() - pendingRequest.timestamp;

            console.log(
              `⭐ Resolving pending request on port ${port} (ID: ${parsedMessage.id}, action: ${pendingRequest.action}, elapsed: ${elapsedTime}ms)`,
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
            portData.pendingRequests.delete(parsedMessage.id);
            resolve(parsedMessage);
            console.log(
              `✅ Request resolved and removed from pending queue (${portData.pendingRequests.size} remaining)`,
            );
          } else if (parsedMessage.id) {
            console.log(
              `⚠️ Received message with ID ${parsedMessage.id} on port ${port} but no matching pending request found`,
            );
            // Log the current pending request IDs for debugging
            console.log(
              `Current pending request IDs: ${Array.from(portData.pendingRequests.keys()).join(", ")}`,
            );
          }

          // Check if this is the handshake message from Blender
          if (
            parsedMessage.type === "handshake" &&
            parsedMessage.client === "blender"
          ) {
            console.log(
              `✅ Received handshake from Blender on port ${port}`,
              parsedMessage,
            );

            // Ensure the connection status is updated to "connected"
            sendStatusUpdate(port, { status: "connected" });

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
              `Received disconnect request from Blender on port ${port}`,
              parsedMessage,
            );

            // Update status immediately
            if (portData.client === ws) {
              sendStatusUpdate(port, { status: "disconnected" });
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
              console.error(
                `Error sending disconnect acknowledgment on port ${port}:`,
                error,
              );
            }
          }

          // Handle other message types as needed
          // If not a handshake or disconnect, forward to renderer if it's a known type or all general messages
          else if (
            parsedMessage.type === "code_executed" ||
            parsedMessage.type === "scene_info"
          ) {
            if (portData.webContents && !portData.webContents.isDestroyed()) {
              // Add detailed logging for scene info responses
              if (parsedMessage.type === "scene_info") {
                console.log(`🎬 Received Blender scene info on port ${port}:`);
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
                } else {
                  console.log("- No scene info data provided");
                }
              } else if (parsedMessage.type === "code_executed") {
                console.log(
                  `💻 Received Blender code execution result on port ${port}:`,
                );
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
                `Forwarding message from Blender on port ${port} to renderer:`,
                parsedMessage,
              );
              portData.webContents.send(
                "blender-message-response",
                parsedMessage,
              );
            }
          }
        } catch (error) {
          console.error(
            `Error processing message from Blender on port ${port}:`,
            error,
          );
        }
      });

      ws.on("close", () => {
        console.log(`Blender client disconnected from port ${port}.`);
        if (portData.client === ws) {
          portData.client = null as unknown as WebSocket;
          sendStatusUpdate(port, { status: "disconnected" });
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
            `WebSocket protocol error during close on port ${port} (expected):`,
            error.message,
          );
        } else {
          // Log other errors
          console.error(
            `Blender client WebSocket error on port ${port}:`,
            error,
          );
          if (portData.client === ws) {
            portData.client = null as unknown as WebSocket;
            // Send error status only if this was the active client
            sendStatusUpdate(port, { status: "error", error: error.message });
          }
        }
      });

      // Optional: Send a welcome message
      ws.send(JSON.stringify({ type: "connection_ack", status: "connected" }));
    });

    wss.on("error", (error: Error) => {
      console.error(
        `❌ Blender WebSocket server error on port ${port}:`,
        error,
      );
      if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
        console.error(
          `Port ${port} is already in use. Try killing any process using this port.`,
        );
        console.error(
          `You can use 'lsof -i :${port}' to find processes using this port.`,
        );
      }
      const errorMessage =
        (error as NodeJS.ErrnoException).code === "EADDRINUSE"
          ? `Port ${port} already in use.`
          : error.message;
      sendStatusUpdate(port, { status: "error", error: errorMessage });
      // Remove from the active ports map
      activePorts.delete(port);
      blenderClients.delete(port);
    });
  } catch (error) {
    console.error(
      `❌ Failed to start Blender WebSocket server on port ${port}:`,
      error,
    );
    console.error(`Stack trace: ${(error as Error).stack}`);
    sendStatusUpdate(port, {
      status: "error",
      error: (error as Error).message,
    });
    // Ensure we clean up the activePorts map
    activePorts.delete(port);
    blenderClients.delete(port);
  }
}

export function stopBlenderSocketServer(port?: number) {
  // If no port specified, close everything
  if (port === undefined) {
    // Clean up all servers
    for (const [port, wss] of activePorts.entries()) {
      closeServerOnPort(port, wss);
    }
    activePorts.clear();
    blenderClients.clear();
    return;
  }

  // Close specific port
  const wss = activePorts.get(port);
  if (wss) {
    closeServerOnPort(port, wss);
    activePorts.delete(port);
    blenderClients.delete(port);
  }
}

function closeServerOnPort(port: number, wss: WebSocketServer) {
  const portData = blenderClients.get(port);

  if (portData) {
    if (portData.heartbeatInterval) {
      clearInterval(portData.heartbeatInterval);
      portData.heartbeatInterval = null;
    }

    if (portData.client && portData.client.readyState === WebSocket.OPEN) {
      portData.client.close();
    }
  }

  wss.close((err) => {
    if (err) {
      console.error(
        `Error closing Blender WebSocket server on port ${port}:`,
        err,
      );
    } else {
      console.log(`Blender WebSocket server on port ${port} stopped.`);
    }

    // Only send status update if we have WebContents for this port
    if (
      portData &&
      portData.webContents &&
      !portData.webContents.isDestroyed()
    ) {
      sendStatusUpdate(port, { status: "stopped" });
    }
  });
}

// Function to check if Blender is connected for a specific port
export function isBlenderConnected(
  port: number = DEFAULT_BLENDER_PORT,
): boolean {
  const portData = blenderClients.get(port);
  return (
    portData !== undefined &&
    portData.client !== undefined &&
    portData.client !== null &&
    portData.client.readyState === WebSocket.OPEN
  );
}

// Function to get the current Blender connection status for a specific port
export function getBlenderStatus(
  port: number = DEFAULT_BLENDER_PORT,
): BlenderConnectionStatus {
  const portData = blenderClients.get(port);

  if (
    portData &&
    portData.client &&
    portData.client.readyState === WebSocket.OPEN
  ) {
    return { status: "connected" };
  } else if (activePorts.has(port)) {
    return { status: "listening" };
  } else {
    return { status: "disconnected" };
  }
}

// Function to get the WebSocketServer instance for a specific port
export function getWebSocketServer(
  port: number = DEFAULT_BLENDER_PORT,
): WebSocketServer | null {
  return activePorts.get(port) || null;
}

// Function to send messages to a specific Blender connection
export function sendToBlender(
  message: object,
  port: number = DEFAULT_BLENDER_PORT,
) {
  if (isBlenderConnected(port)) {
    try {
      const portData = blenderClients.get(port);
      if (portData && portData.client) {
        portData.client.send(JSON.stringify(message));
        console.log(`Sent to Blender on port ${port}:`, message);
      }
    } catch (error) {
      console.error(
        `Failed to send message to Blender on port ${port}:`,
        error,
      );
    }
  } else {
    console.warn(
      `Cannot send message: Blender client not connected or ready on port ${port}.`,
    );
  }
}

// Function to send a request to a specific Blender connection and wait for response
export async function requestFromBlender(
  action: string,
  params: any = {},
  port: number = DEFAULT_BLENDER_PORT,
  timeoutMs: number = 300000, // Increased timeout to match Blender's 30-second timeout
): Promise<BlenderResponseMessage> {
  console.log(
    `📤 requestFromBlender on port ${port}: Starting request for action "${action}"`,
  );
  console.log(`   Params: ${JSON.stringify(params).substring(0, 100)}`);

  // Get port data
  const portData = blenderClients.get(port);
  if (!portData) {
    console.error(`No port data found for port ${port}`);
    return Promise.reject(
      new Error(`No Blender connection found for port ${port}`),
    );
  }

  console.log(`   Current pending requests: ${portData.pendingRequests.size}`);

  return new Promise((resolve, reject) => {
    if (!isBlenderConnected(port)) {
      console.error(
        `❌ requestFromBlender: Blender is not connected on port ${port}`,
      );
      return reject(new Error(`Blender is not connected on port ${port}`));
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
    portData.pendingRequests.set(messageId, {
      resolve,
      reject,
      action,
      timestamp: Date.now(),
    });

    console.log(
      `🗂️ requestFromBlender: Added to pending requests for port ${port} (now ${portData.pendingRequests.size})`,
    );

    // Set timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      if (portData.pendingRequests.has(messageId)) {
        console.error(
          `⏰ requestFromBlender: Request timed out for ID ${messageId} on port ${port} (action: ${action})`,
        );
        portData.pendingRequests.delete(messageId);
        reject(
          new Error(
            `Request to Blender on port ${port} timed out after ${timeoutMs}ms. Action: ${action}`,
          ),
        );
      }
    }, timeoutMs);

    // Send the message
    try {
      if (portData.client) {
        portData.client.send(JSON.stringify(message));
        console.log(
          `📨 requestFromBlender: Message sent to Blender on port ${port} (ID: ${messageId}, action: ${action})`,
        );
      } else {
        console.error(`Client for port ${port} is null or undefined`);
        reject(new Error(`Client for port ${port} is null or undefined`));
      }
    } catch (error) {
      console.error(
        `❌ requestFromBlender: Error sending message on port ${port}:`,
        error,
      );
      clearTimeout(timeoutId);
      portData.pendingRequests.delete(messageId);
      reject(error);
    }
  });
}
