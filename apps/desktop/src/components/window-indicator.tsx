import { useEffect, useState } from "react";
import { LayoutGrid, Plus } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@repo/ui/components/ui/tooltip";

export function WindowIndicator() {
  const [windowInfo, setWindowInfo] = useState<{
    index: number;
    total: number;
    id: number;
  }>({
    index: 0,
    total: 1,
    id: 0,
  });

  useEffect(() => {
    if (window.electronWindow) {
      window.electronWindow.getInfo().then((info) => {
        setWindowInfo(info);
      });
    }

    // Setup an interval to periodically update window info
    const intervalId = setInterval(() => {
      if (window.electronWindow) {
        window.electronWindow.getInfo().then((info) => {
          setWindowInfo(info);
        });
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(intervalId);
  }, []);

  const createNewWindow = () => {
    if (window.electronWindow) {
      window.electronWindow.newWindow();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" className="h-auto p-0">
          <div className="text-muted-foreground flex items-center gap-1 text-[0.65rem]">
            <LayoutGrid className="size-3" />
            <span>Window: {windowInfo.index + 1}</span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={createNewWindow}>
          <Plus className="mr-2 size-3" />
          <span>New Window</span>
          <span className="text-muted-foreground ml-auto text-xs">⌘⇧N</span>
        </DropdownMenuItem>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="w-full">
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <div className="flex items-center gap-2">
                  <span>
                    Window #{windowInfo.index + 1} of {windowInfo.total}
                  </span>
                </div>
              </DropdownMenuItem>
            </TooltipTrigger>
            <TooltipContent>
              <p>Window ID: {windowInfo.id}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
