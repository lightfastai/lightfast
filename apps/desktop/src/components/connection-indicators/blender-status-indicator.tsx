import { useEffect } from "react";
import {
  BlenderConnectionStatus,
  useBlenderStore,
} from "@/stores/blender-store";

import { cn } from "@repo/ui/lib/utils";

const getStatusInfo = (
  status: BlenderConnectionStatus,
): { color: string; title: string; pulse: boolean } => {
  switch (status.status) {
    case "connected":
      return {
        color: "bg-green-500",
        title: "Blender Connected",
        pulse: false,
      };
    case "listening":
      return {
        color: "bg-yellow-500",
        title: "Waiting for Blender connection...",
        pulse: true,
      };
    case "disconnected":
      return {
        color: "bg-gray-500",
        title: "Blender Disconnected",
        pulse: false,
      };
    case "stopped":
      return {
        color: "bg-gray-500",
        title: "Connection Stopped",
        pulse: false,
      };
    case "error":
      return {
        color: "bg-red-500",
        title: `Connection Error: ${status.error || "Unknown"}`,
        pulse: false,
      };
    default:
      return {
        color: "bg-gray-300",
        title: "Unknown Status",
        pulse: false,
      };
  }
};

export function BlenderStatusIndicator() {
  const connectionStatus = useBlenderStore((state) => state.connectionStatus);

  // Add a debug log to see when the status changes
  useEffect(() => {
    console.log(
      "BlenderStatusIndicator: connection status changed to",
      connectionStatus,
    );

    // If we're in a disconnected state, we can add a recheck mechanism here
    if (connectionStatus.status === "disconnected") {
      // Try to force a status check with the main process if needed
      if (window.blenderConnection) {
        console.log("Requesting current Blender status...");

        // Type assertion to access the getStatus method
        const blenderConn = window.blenderConnection as {
          getStatus?: () => Promise<BlenderConnectionStatus>;
          onStatusUpdate: (
            callback: (status: BlenderConnectionStatus) => void,
          ) => () => void;
          sendToBlender: (message: object) => Promise<any>;
        };

        if (blenderConn.getStatus) {
          blenderConn
            .getStatus()
            .then((status: BlenderConnectionStatus) => {
              console.log("Current blender status:", status);
              // Update the store with the new status if different
              if (status.status !== connectionStatus.status) {
                useBlenderStore.setState({ connectionStatus: status });
              }
            })
            .catch((err: Error) => console.error("Error getting status:", err));
        }
      }
    }
  }, [connectionStatus]);

  const { color, title, pulse } = getStatusInfo(connectionStatus);

  return (
    <div className="flex items-center gap-2" title={title}>
      <div
        className={cn("h-2 w-2 rounded-full", color, pulse && "animate-pulse")}
      />
      <span className="text-xs">Blender</span>
    </div>
  );
}
