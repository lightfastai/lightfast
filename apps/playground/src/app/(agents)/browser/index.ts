import type { RuntimeContext } from "@lightfast/core/agent/server/adapters/types";
import { createTool } from "@lightfast/core/tool";
import {
  StagehandSessionManager,
  performWebAction,
  performWebObservation,
  performWebExtraction,
  performWebNavigation,
  takeScreenshot,
} from "@lightfast/lightfast-tools/browserbase";
import { z } from "zod";
import { put } from "@vendor/storage";
import { env } from "~/env";
import type { AppRuntimeContext } from "../shared-types";

// ============================================
// BROWSER_010 SYSTEM PROMPT
// ============================================
export const BROWSER_010_SYSTEM_PROMPT = `
<system>
  <role>
    <identity>Browser Automation Agent browser_010 - Stagehand-Powered Web Interaction Specialist</identity>
    <core_competencies>
      - Advanced browser automation using Stagehand
      - Visual web page analysis and element interaction
      - Form automation and data extraction
      - Multi-step web workflow orchestration
      - Screenshot capture and visual verification
      - Complex navigation and state management
      - Real-time progress tracking
    </core_competencies>
    <expertise_level>Expert in browser automation using Stagehand for complex web interactions</expertise_level>
  </role>

  <objective>
    Navigate websites, interact with web elements, extract information, and automate complex browser-based workflows using Stagehand browser automation tools. Provide transparent progress tracking and visual verification of actions.
  </objective>

  <error_handling>
    <rate_limiting>
      CRITICAL: If you encounter a 429 error (Too Many Requests), immediately respond with:
      "Sorry, you've hit the rate limit. Please try again in 5 minutes."
      Do NOT attempt to retry or continue with the action.
    </rate_limiting>
  </error_handling>

  <tool_usage>
    <critical_rule>ALWAYS write a brief description of what you're about to do BEFORE making any tool call. Never make consecutive tool calls without text in between.</critical_rule>
    
    <stagehand_browser_tools>
      <principles>Use Stagehand tools for precise browser control and interaction</principles>
      <tools>
        - stagehandNavigate: Navigate to URLs in the browser
        - stagehandAct: Interact with elements using natural language (e.g., "click sign in button")
        - stagehandObserve: Observe elements to plan actions
        - stagehandExtract: Extract data from pages with optional schema
        - stagehandScreenshot: Take screenshots of page or elements
      </tools>
      <practices>
        - Always take screenshots to verify state
        - Use natural language for actions (e.g., "click the login button")
        - Observe before acting to understand page structure
        - Extract data with clear instructions
        - Handle navigation and loading states gracefully
      </practices>
    </stagehand_browser_tools>
  </tool_usage>

  <execution_patterns>
    <browser_workflow>
      <steps>
        1. Navigate to target URL
        2. Observe page state with screenshot
        3. Act on elements (click, type, select)
        4. Extract required data
        5. Verify results with screenshots
      </steps>
    </browser_workflow>
  </execution_patterns>

  <communication_style>
    <guidelines>
      - Describe each browser action clearly
      - Provide visual feedback via screenshots
      - Report extracted data comprehensively
      - Explain any errors or limitations
    </guidelines>
  </communication_style>
</system>

CRITICAL TOOL USAGE RULE: You MUST write a brief descriptive sentence before EVERY tool call. This ensures users understand each browser action.
`;

// ============================================
// STAGEHAND SESSION MANAGER
// ============================================

// Initialize the session manager with config
const sessionManager = StagehandSessionManager.getInstance({
  apiKey: env.BROWSERBASE_API_KEY,
  projectId: env.BROWSERBASE_PROJECT_ID,
  anthropicApiKey: env.ANTHROPIC_API_KEY,
  modelName: "claude-3-7-sonnet-latest",
  enableCaptchaSolving: true,
  enableAdvancedStealth: false, // Set to true if on Scale Plan
  viewportWidth: 1280,
  viewportHeight: 720,
});

// ============================================
// STAGEHAND TOOLS
// ============================================

// Navigate tool
export const stagehandNavigateTool = createTool<RuntimeContext<AppRuntimeContext>>({
  description: "Navigate to a URL in the browser",
  inputSchema: z.object({
    url: z.string().transform((val) => {
      // If URL doesn't start with protocol, add https://
      if (!(/^https?:\/\//i.exec(val))) {
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
  }),
  execute: async ({ url }, context) => {
    try {
      const result = await performWebNavigation(sessionManager, url);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Navigation failed: ${errorMessage}`,
      };
    }
  },
});

// Act tool
export const stagehandActTool = createTool<RuntimeContext<AppRuntimeContext>>({
  description: "Take an action on a webpage using Stagehand",
  inputSchema: z.object({
    url: z.string().optional().describe("URL to navigate to (optional if already on a page)"),
    action: z.string().describe('Action to perform (e.g., "click sign in button", "type hello in search field")'),
  }),
  execute: async ({ url, action }, context) => {
    try {
      const result = await performWebAction(sessionManager, url, action);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Stagehand action failed: ${errorMessage}`);
    }
  },
});

// Observe tool
export const stagehandObserveTool = createTool<RuntimeContext<AppRuntimeContext>>({
  description: "Observe elements on a webpage using Stagehand to plan actions",
  inputSchema: z.object({
    url: z.string().optional().describe("URL to navigate to (optional if already on a page)"),
    instruction: z.string().describe('What to observe (e.g., "find the sign in button")'),
  }),
  outputSchema: z.array(z.unknown()).describe("Array of observable actions"),
  execute: async ({ url, instruction }, context) => {
    try {
      const actions = await performWebObservation(sessionManager, url, instruction);
      return actions;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Stagehand observation failed: ${errorMessage}`);
    }
  },
});

// Extract tool
export const stagehandExtractTool = createTool<RuntimeContext<AppRuntimeContext>>({
  description: "Extract data from a webpage using Stagehand",
  inputSchema: z.object({
    url: z.string().optional().describe("URL to navigate to (optional if already on a page)"),
    instruction: z.string().describe('What to extract (e.g., "extract all product prices")'),
    schema: z.record(z.unknown()).optional().describe("Zod schema definition for data extraction"),
    useTextExtract: z
      .boolean()
      .optional()
      .describe("Set true for larger-scale extractions, false for small extractions"),
  }),
  outputSchema: z.unknown().describe("Extracted data according to schema"),
  execute: async ({ url, instruction, schema, useTextExtract }, context) => {
    try {
      const defaultSchema = { content: z.string() };
      const finalSchemaObj = schema || defaultSchema;
      
      const result = await performWebExtraction(
        sessionManager,
        url,
        instruction,
        finalSchemaObj as Record<string, z.ZodTypeAny>,
        useTextExtract
      );
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Stagehand extraction failed: ${errorMessage}`);
    }
  },
});

// Screenshot tool
export const stagehandScreenshotTool = createTool<RuntimeContext<AppRuntimeContext>>({
  description: "Take a screenshot of the current page",
  inputSchema: z.object({
    fullPage: z.boolean().optional().describe("Capture full page or viewport only"),
    selector: z.string().optional().describe("CSS selector of element to capture"),
  }),
  execute: async ({ fullPage = false, selector }, context) => {
    try {
      const screenshotBuffer = await takeScreenshot(sessionManager, {
        fullPage,
        selector,
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      // Include resourceId and timestamp in filename
      const filename = `screenshot-${context.resourceId}-${timestamp}.png`;

      // Upload screenshot to Vercel Blob under sessionId directory
      const blobPath = `screenshots/${context.sessionId}/${filename}`;
      const blob = await put(blobPath, screenshotBuffer, {
        access: 'public',
        addRandomSuffix: false,
        token: env.BLOB_READ_WRITE_TOKEN,
      });
      
      return {
        success: true,
        filename,
        size: screenshotBuffer.length,
        path: blobPath,
        url: blob.url,
        screenshot: blob.url, // URL for direct display in browser viewer
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

// Cleanup function
export async function cleanup() {
  await sessionManager.close();
}

// Export all tools
export const browser010Tools = {
  stagehandNavigate: stagehandNavigateTool,
  stagehandAct: stagehandActTool,
  stagehandObserve: stagehandObserveTool,
  stagehandExtract: stagehandExtractTool,
  stagehandScreenshot: stagehandScreenshotTool,
} as const;

export type Browser010ToolSchema = typeof browser010Tools;