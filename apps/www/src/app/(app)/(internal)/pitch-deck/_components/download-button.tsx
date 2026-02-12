"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@repo/ui/components/ui/button";
import { exportSlidesToPdfLazy } from "../_lib/export-slides-lazy";

export function DownloadButton() {
  const [isExporting, setIsExporting] = useState(false);

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
    <Button variant="ghost" onClick={handleDownload} disabled={isExporting}>
      {isExporting ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
    </Button>
  );
}
