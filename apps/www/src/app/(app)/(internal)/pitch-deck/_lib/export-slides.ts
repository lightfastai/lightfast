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
  debug?: boolean;
}

const DEFAULT_OPTIONS: Required<ExportOptions> = {
  width: 1920,
  height: 1080,
  filename: "lightfast-pitch-deck",
  debug: false,
};

/**
 * Captures all slides as images and downloads as a single PDF.
 * Uses ReactDOM to render slides off-screen for consistent styling.
 */
export async function exportSlidesToPdf(
  options: ExportOptions = {}
): Promise<void> {
  const { width, height, filename, debug } = { ...DEFAULT_OPTIONS, ...options };

  // Create PDF with landscape orientation matching slide aspect ratio
  // jsPDF uses points (pt) as default unit, but we can specify dimensions in px
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [width, height],
    hotfixes: ["px_scaling"],
  });

  // Wait for all fonts to be loaded before capturing
  await document.fonts.ready;

  // Create off-screen container for rendering
  // In debug mode, make it visible for inspection
  const container = document.createElement("div");
  container.style.cssText = debug
    ? `
      position: fixed;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%) scale(0.4);
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      z-index: 9999;
      box-shadow: 0 0 0 4px red;
    `
    : `
      position: fixed;
      left: -9999px;
      top: 0;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      z-index: -1;
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
          })
        );
      });

      // Delay to ensure styles are computed (longer in debug mode for inspection)
      await new Promise((resolve) => setTimeout(resolve, debug ? 3000 : 50));

      // Capture as canvas
      const slideElement = renderContainer.firstElementChild as HTMLElement;

      // In debug mode, log computed styles for inspection
      if (debug) {
        const computed = window.getComputedStyle(slideElement);
        console.log(`[Slide ${i + 1}] Computed styles:`, {
          fontFamily: computed.fontFamily,
          fontSize: computed.fontSize,
          color: computed.color,
          backgroundColor: computed.backgroundColor,
        });
      }
      const canvas = await html2canvas(slideElement, {
        width,
        height,
        scale: 1,
        useCORS: true,
        logging: false,
        backgroundColor: null,
      });

      // Add canvas as image to PDF
      // Use PNG format for high quality (no JPEG artifacts)
      const imgData = canvas.toDataURL("image/png", 1.0);

      // First page is already created, add new pages for subsequent slides
      if (i > 0) {
        pdf.addPage([width, height], "landscape");
      }

      // Add image at position (0, 0) with full page dimensions
      pdf.addImage(imgData, "PNG", 0, 0, width, height);
    }

    // Clean up React root
    root.unmount();

    // Save PDF (triggers browser download)
    pdf.save(`${filename}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
