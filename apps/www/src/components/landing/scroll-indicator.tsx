import { ChevronDown } from "lucide-react";

export const ScrollIndicator = () => {
  return (
    <div className="scroll-indicator-floating fixed bottom-4 left-1/2 z-30 flex -translate-x-1/2 transform flex-col items-center">
      {/* SCROLL text */}
      <div className="flex flex-row items-center gap-2">
        <span className="text-muted-foreground font-mono text-xs font-black tracking-widest uppercase">
          SCROLL
        </span>{" "}
        <ChevronDown className="text-muted-foreground h-4 w-4 animate-bounce" />
      </div>
    </div>
  );
};
