import React from "react";

import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandList,
} from "@repo/ui/components/ui/command";

interface WorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  placeholder?: string;
}

export default function WorkspaceDialog({
  open,
  onOpenChange,
  children,
  placeholder = "Type a command or search...",
}: WorkspaceDialogProps) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder={placeholder} />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {children}
      </CommandList>
    </CommandDialog>
  );
}
