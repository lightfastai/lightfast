import type { ExportOptions } from "./export-slides";

/**
 * Lazy-loads PDF export libraries and executes export.
 * This keeps html2canvas-pro and jspdf out of the initial bundle.
 */
export async function exportSlidesToPdfLazy(
  options: ExportOptions = {},
): Promise<void> {
  const { exportSlidesToPdf } = await import("./export-slides");
  return exportSlidesToPdf(options);
}
