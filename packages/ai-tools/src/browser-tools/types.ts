/**
 * Client-side safe type definitions for browser automation tools.
 * These types can be imported by client-side components without causing build errors.
 */

import { z } from "zod";

// ============================================
// TOOL INPUT SCHEMAS
// ============================================

export const stagehandNavigateSchema = z.object({
  url: z.string().transform((val) => {
    // If URL doesn't start with protocol, add https://
    if (!val.match(/^https?:\/\//i)) {
      val = `https://${val}`;
    }
    // Validate the URL
    try {
      new URL(val);
      return val;
    } catch {
      throw new Error(`Invalid URL: ${val}`);
    }
  }).describe("URL to navigate to"),
});

export const stagehandActSchema = z.object({
  url: z.string().optional().describe("URL to navigate to (optional if already on a page)"),
  action: z.string().describe('Action to perform (e.g., "click sign in button", "type hello in search field")'),
});

export const stagehandObserveSchema = z.object({
  url: z.string().optional().describe("URL to navigate to (optional if already on a page)"),
  instruction: z.string().describe('What to observe (e.g., "find the sign in button")'),
});

export const stagehandExtractSchema = z.object({
  url: z.string().optional().describe("URL to navigate to (optional if already on a page)"),
  instruction: z.string().describe('What to extract (e.g., "extract all product prices")'),
  schema: z.record(z.unknown()).optional().describe("Zod schema definition for data extraction"),
  useTextExtract: z
    .boolean()
    .optional()
    .describe("Set true for larger-scale extractions, false for small extractions"),
});

export const stagehandScreenshotSchema = z.object({
  fullPage: z.boolean().optional().describe("Capture full page or viewport only"),
  selector: z.string().optional().describe("CSS selector of element to capture"),
});

// ============================================
// TOOL TYPE DEFINITIONS
// ============================================

/**
 * Type definitions that mirror the actual tool implementations
 * but without server-side dependencies or runtime context.
 */

export interface StagehandNavigateToolType {
  description: "Navigate to a URL in the browser";
  parameters: z.infer<typeof stagehandNavigateSchema>;
}

export interface StagehandActToolType {
  description: "Take an action on a webpage using Stagehand";
  parameters: z.infer<typeof stagehandActSchema>;
}

export interface StagehandObserveToolType {
  description: "Observe elements on a webpage using Stagehand to plan actions";
  parameters: z.infer<typeof stagehandObserveSchema>;
}

export interface StagehandExtractToolType {
  description: "Extract data from a webpage using Stagehand";
  parameters: z.infer<typeof stagehandExtractSchema>;
}

export interface StagehandScreenshotToolType {
  description: "Take a screenshot of the current page";
  parameters: z.infer<typeof stagehandScreenshotSchema>;
}

// ============================================
// TOOL SET TYPE
// ============================================

/**
 * Complete tool set interface for browser automation.
 * This can be used by UI components for type inference without importing implementations.
 */
export interface BrowserToolSet {
  stagehandNavigate: StagehandNavigateToolType;
  stagehandAct: StagehandActToolType;
  stagehandObserve: StagehandObserveToolType;
  stagehandExtract: StagehandExtractToolType;
  stagehandScreenshot: StagehandScreenshotToolType;
}

// ============================================
// TYPE UTILITIES
// ============================================

export type BrowserToolName = keyof BrowserToolSet;

export type BrowserToolParameters<T extends BrowserToolName> = BrowserToolSet[T]["parameters"];

// ============================================
// INPUT TYPE EXPORTS
// ============================================

export type StagehandNavigateInput = z.infer<typeof stagehandNavigateSchema>;
export type StagehandActInput = z.infer<typeof stagehandActSchema>;
export type StagehandObserveInput = z.infer<typeof stagehandObserveSchema>;
export type StagehandExtractInput = z.infer<typeof stagehandExtractSchema>;
export type StagehandScreenshotInput = z.infer<typeof stagehandScreenshotSchema>;