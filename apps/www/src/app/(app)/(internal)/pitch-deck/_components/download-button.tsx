"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Icons } from "@repo/ui/components/icons";
import { exportSlidesToPdf } from "../_lib/export-slides";

export function DownloadButton() {
  const [isExporting, setIsExporting] = useState(false);

  const handleDownload = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      // TODO: Remove debug: true after testing fonts
      await exportSlidesToPdf({ debug: true });
    } catch (error) {
      console.error("Failed to export slides:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDownload}
      disabled={isExporting}
      className="text-sm text-foreground hover:text-muted-foreground transition-colors"
    >
      {isExporting ? (
        <>
          <Icons.loader className="mr-2 h-4 w-4 animate-spin" />
        </>
      ) : (
        <>
          <Icons.download className="mr-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
}
