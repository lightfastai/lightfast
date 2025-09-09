"use client";

import { Grid3x3, List } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";

export type ViewType = "grid" | "list";

interface ViewToggleProps {
  view: ViewType;
  onViewChange: (view: ViewType) => void;
}

export function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex rounded-md border border-border">
      <Button
        variant="ghost"
        size="sm"
        className={`h-8 px-3 rounded-none border-0 ${
          view === "grid" 
            ? "bg-muted text-foreground" 
            : "bg-transparent text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => onViewChange("grid")}
      >
        <Grid3x3 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={`h-8 px-3 rounded-none border-0 ${
          view === "list" 
            ? "bg-muted text-foreground" 
            : "bg-transparent text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => onViewChange("list")}
      >
        <List className="h-4 w-4" />
      </Button>
    </div>
  );
}