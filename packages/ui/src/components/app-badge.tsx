import { Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface AppBadgeProps {
  description: string;
  title: string;
}

export function AppBadge({ title, description }: AppBadgeProps) {
  return (
    <div className="mb-2 flex items-center gap-1">
      <h1 className="font-mono text-muted-foreground text-xs">{title}</h1>
      <Popover>
        <PopoverTrigger asChild>
          <button className="transition-opacity hover:opacity-70" type="button">
            <Info className="h-3 w-3 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" side="right">
          <p className="text-sm">{description}</p>
        </PopoverContent>
      </Popover>
    </div>
  );
}
