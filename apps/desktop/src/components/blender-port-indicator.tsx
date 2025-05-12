import { useEffect, useState } from "react";
import { CheckCircle, Pencil, Save, ServerIcon, XCircle } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";

import { DEFAULT_BLENDER_PORT } from "../main/blender-connection";
import { useBlenderStore } from "../stores/blender-store";

export function BlenderPortIndicator() {
  const [blenderPort, setBlenderPort] = useState<number>(DEFAULT_BLENDER_PORT);
  const [windowId, setWindowId] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState<string>("");
  const [isUpdating, setIsUpdating] = useState(false);

  const connectionStatus = useBlenderStore((state) => state.connectionStatus);
  const isConnected = connectionStatus.status === "connected";

  // Get port and window info
  useEffect(() => {
    if (window.blenderConnection) {
      window.blenderConnection.getPort().then((port: number) => {
        setBlenderPort(port);
        setInputValue(port.toString());
      });
    }

    // Get window unique ID
    if (window.electronWindow) {
      window.electronWindow.getInfo().then((info) => {
        setWindowId(info.uniqueId || `${info.index + 1}`);
      });
    }
  }, []);

  const handleSavePort = async () => {
    const newPort = parseInt(inputValue, 10);

    // Validate port number
    if (isNaN(newPort) || newPort < 1024 || newPort > 65535) {
      alert("Please enter a valid port number between 1024 and 65535");
      return;
    }

    setIsUpdating(true);

    try {
      // Call new method to update the port
      if (window.blenderConnection) {
        const success = await window.blenderConnection.setPort(newPort);
        if (success) {
          setBlenderPort(newPort);
          setIsEditing(false);
        } else {
          alert("Failed to update port. It may be in use or inaccessible.");
        }
      }
    } catch (error) {
      console.error("Error updating port:", error);
      alert("An error occurred while updating the port");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Popover open={isEditing} onOpenChange={setIsEditing}>
      <PopoverTrigger asChild>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="xs" className="h-auto p-0">
                <div className="text-muted-foreground flex items-center gap-1 text-[0.65rem]">
                  <ServerIcon
                    className={`size-3 ${isConnected ? "text-green-500" : "text-orange-500"}`}
                  />
                  <span>
                    Port: {blenderPort} ({windowId})
                  </span>
                  <Pencil className="ml-1 size-3 opacity-50" />
                </div>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Click to configure the Blender connection port</p>
              <p className="text-muted-foreground text-xs">
                {isConnected
                  ? "Connected to Blender"
                  : "Not connected to Blender"}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Window {windowId} is using port {blenderPort}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </PopoverTrigger>
      <PopoverContent className="w-60">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Configure Blender Port</h4>
            {isConnected ? (
              <div className="flex items-center gap-1 text-xs text-green-500">
                <CheckCircle className="size-3" />
                <span>Connected</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-orange-500">
                <XCircle className="size-3" />
                <span>Not connected</span>
              </div>
            )}
          </div>
          <p className="text-muted-foreground text-xs">
            Set the port for window {windowId}'s Blender connection.
          </p>
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="h-8"
              type="number"
              min="1024"
              max="65535"
              disabled={isUpdating}
            />
            <Button
              size="sm"
              onClick={handleSavePort}
              disabled={isUpdating}
              className={isUpdating ? "opacity-50" : ""}
            >
              <Save className="mr-1 size-3" />
              {isUpdating ? "Saving..." : "Save"}
            </Button>
          </div>
          <p className="text-muted-foreground text-xs">
            Configure your Blender addon to use this port.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
