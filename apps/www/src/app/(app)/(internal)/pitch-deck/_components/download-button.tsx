"use client";

import { Button } from "@repo/ui/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { exportSlidesToPdfLazy } from "../_lib/export-slides-lazy";

export function DownloadButton() {
  const [isExporting, setIsExporting] = useState(false);

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
    <Button disabled={isExporting} onClick={handleDownload} variant="ghost">
      {isExporting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
    </Button>
  );
}
