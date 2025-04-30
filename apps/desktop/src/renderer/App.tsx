import React, { useEffect } from "react";
import WorkspaceDialog from "@/components/workspace-dialog";

import { Button } from "@repo/ui/components/ui/button";
import { Command, CommandInput } from "@repo/ui/components/ui/command";

export function App() {
  const [message, setMessage] = React.useState<string>("");
  const [open, setOpen] = React.useState<boolean>(false);

  useEffect(() => {
    // Test IPC communication
    window.electron.ping().then((response) => {
      setMessage(response);
    });
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="space-y-4">
        <Button variant="outline" onClick={() => setOpen(true)}>
          Click me
        </Button>
        <WorkspaceDialog open={open} onOpenChange={setOpen}>
          <Command>
            <CommandInput placeholder="Search..." />
          </Command>
        </WorkspaceDialog>
        <h1 className="text-foreground font-mono text-4xl font-bold">
          Lightfast Desktop
        </h1>
        <p>IPC Test: {message}</p>
      </div>
    </div>
  );
}
