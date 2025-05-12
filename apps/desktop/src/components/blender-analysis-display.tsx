import { cn } from "@repo/ui/lib/utils";

import { useBlenderAnalysisStream } from "../hooks/use-blender-analysis-stream";

interface BlenderAnalysisDisplayProps {
  sessionId: string;
  className?: string;
}

export function BlenderAnalysisDisplay({
  sessionId,
  className,
}: BlenderAnalysisDisplayProps) {
  const analysisState = useBlenderAnalysisStream(sessionId);

  if (
    analysisState.status === "idle" ||
    (!analysisState.currentContent && !analysisState.errorMessage)
  ) {
    return null;
  }

  return (
    <div className={cn("w-full border-t p-4", className)}>
      <h4 className="mb-2 text-sm font-semibold">
        {analysisState.status === "error"
          ? "Blender Analysis Error"
          : analysisState.status === "completed"
            ? "Blender Analysis Complete"
            : "Blender Analysis Stream"}
      </h4>

      {analysisState.status === "error" && (
        <div className="text-destructive bg-destructive/10 mb-2 rounded p-2 text-xs">
          {analysisState.errorMessage}
        </div>
      )}

      {analysisState.currentContent && (
        <div className="bg-muted max-h-60 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
          {analysisState.currentContent}
        </div>
      )}

      {analysisState.status === "streaming" && (
        <div className="text-muted-foreground mt-2 animate-pulse text-xs">
          Streaming analysis...
        </div>
      )}
    </div>
  );
}
