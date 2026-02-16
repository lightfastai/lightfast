"use client";

import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { PITCH_SLIDES } from "~/config/pitch-deck-data";
import { CaptureSlide } from "../_components/capture-slide";

export interface ExportOptions {
  width?: number;
  height?: number;
  filename?: string;
}

const DEFAULT_OPTIONS: Required<ExportOptions> = {
  width: 1920,
  height: 1080,
  filename: "lightfast-pitch-deck",
};

/**
 * Captures all slides as images and downloads as a single PDF.
 * Uses ReactDOM to render slides off-screen for consistent styling.
 */
export async function exportSlidesToPdf(
  options: ExportOptions = {},
): Promise<void> {
  const { width, height, filename } = { ...DEFAULT_OPTIONS, ...options };

  // Create PDF with landscape orientation matching slide aspect ratio
  // jsPDF uses points (pt) as default unit, but we can specify dimensions in px
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [width, height],
    hotfixes: ["px_scaling"],
    compress: true,
  });

  // Wait for all fonts to be loaded before capturing
  await document.fonts.ready;

  // Resolve the actual font-family from the body (bypasses CSS variable issues in html2canvas)
  const resolvedFontFamily = getComputedStyle(document.body).fontFamily;

  // Create off-screen container for rendering
  const container = document.createElement("div");
  // Copy font CSS variable classes from <html> so CSS variables are defined
  container.className = document.documentElement.className;
  container.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: ${width}px;
    height: ${height}px;
    overflow: hidden;
    z-index: -1;
    font-family: ${resolvedFontFamily};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  `;
  document.body.appendChild(container);

  // Create wrapper for React rendering
  const renderContainer = document.createElement("div");
  container.appendChild(renderContainer);

  const root = createRoot(renderContainer);

  try {
    for (const [i, slide] of PITCH_SLIDES.entries()) {
      // Render slide using React with flushSync for synchronous rendering
      flushSync(() => {
        root.render(
          createElement(CaptureSlide, {
            slide,
            width,
            height,
            fontFamily: resolvedFontFamily,
          }),
        );
      });

      // Delay to ensure styles and fonts are fully computed at high resolution
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Capture as canvas
      const slideElement = renderContainer.firstElementChild as HTMLElement;
      const canvas = await html2canvas(slideElement, {
        width,
        height,
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        imageTimeout: 0,
        onclone: (clonedDoc) => {
          // Ensure the cloned document has font CSS variable classes and resolved font-family
          clonedDoc.documentElement.className = document.documentElement.className;
          clonedDoc.body.style.fontFamily = resolvedFontFamily;
          clonedDoc.body.style.setProperty("-webkit-font-smoothing", "antialiased");
          clonedDoc.body.style.setProperty("text-rendering", "optimizeLegibility");
        },
      });

      // Add canvas as image to PDF
      // JPEG at 0.92 quality is visually indistinguishable from PNG but ~10-20x smaller
      const imgData = canvas.toDataURL("image/jpeg", 0.92);

      // First page is already created, add new pages for subsequent slides
      if (i > 0) {
        pdf.addPage([width, height], "landscape");
      }

      // Add image at position (0, 0) with full page dimensions
      pdf.addImage(imgData, "JPEG", 0, 0, width, height);
    }

    // Clean up React root
    root.unmount();

    // Save PDF (triggers browser download)
    pdf.save(`${filename}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
