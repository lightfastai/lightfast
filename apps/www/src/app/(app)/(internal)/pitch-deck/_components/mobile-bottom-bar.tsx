"use client";

import { useState } from "react";
import { Download, Loader2, Maximize } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { exportSlidesToPdfLazy } from "../_lib/export-slides-lazy";
import { LandscapePromptModal } from "./landscape-prompt-modal";

export function MobileBottomBar() {
  const [isExporting, setIsExporting] = useState(false);
  const [showLandscapePrompt, setShowLandscapePrompt] = useState(false);

  const handleDownload = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      await exportSlidesToPdfLazy();
    } catch (error) {
      console.error("Failed to export slides:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-center gap-3 px-4 py-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={isExporting}
            className="flex-1 max-w-[160px]"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download PDF
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => setShowLandscapePrompt(true)}
            className="flex-1 max-w-[160px]"
          >
            <Maximize className="h-4 w-4 mr-2" />
            Full Screen
          </Button>
        </div>
      </div>

      <LandscapePromptModal
        open={showLandscapePrompt}
        onOpenChange={setShowLandscapePrompt}
      />
    </>
  );
}
