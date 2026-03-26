"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Download, Loader2, Maximize } from "lucide-react";
import { useState } from "react";
import { exportSlidesToPdfLazy } from "../_lib/export-slides-lazy";
import { LandscapePromptModal } from "./landscape-prompt-modal";

export function MobileBottomBar() {
  const [isExporting, setIsExporting] = useState(false);
  const [showLandscapePrompt, setShowLandscapePrompt] = useState(false);

  const handleDownload = async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    try {
      await exportSlidesToPdfLazy();
    } catch (error) {
      console.error("Failed to export slides:", error);
    }
    setIsExporting(false);
  };

  return (
    <>
      <div className="fixed right-0 bottom-0 left-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
        <div className="flex items-center justify-center gap-3 px-4 py-3">
          <Button
            className="max-w-[160px] flex-1"
            disabled={isExporting}
            onClick={handleDownload}
            size="sm"
            variant="outline"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download PDF
          </Button>

          <Button
            className="max-w-[160px] flex-1"
            onClick={() => setShowLandscapePrompt(true)}
            size="sm"
            variant="default"
          >
            <Maximize className="mr-2 h-4 w-4" />
            Full Screen
          </Button>
        </div>
      </div>

      <LandscapePromptModal
        onOpenChange={setShowLandscapePrompt}
        open={showLandscapePrompt}
      />
    </>
  );
}
