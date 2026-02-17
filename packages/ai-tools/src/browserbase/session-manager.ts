import { Stagehand } from "@browserbasehq/stagehand";
import type { z } from "zod";

export interface StagehandConfig {
  apiKey: string;
  projectId: string;
  anthropicApiKey: string;
  modelName?: string;
  enableCaptchaSolving?: boolean;
  enableAdvancedStealth?: boolean;
  viewportWidth?: number;
  viewportHeight?: number;
}

export class StagehandSessionManager {
  private static instance: StagehandSessionManager;
  private stagehand: Stagehand | null = null;
  private initialized = false;
  private lastUsed = Date.now();
  private readonly sessionTimeout = 10 * 60 * 1000; // 10 minutes
  private intervalId: NodeJS.Timeout | null = null;
  private config: StagehandConfig;

  private constructor(config: StagehandConfig) {
    this.config = config;
    // Schedule session cleanup to prevent memory leaks
    this.intervalId = setInterval(() => this.checkAndCleanupSession(), 60 * 1000);
  }

  /**
   * Get the singleton instance of StagehandSessionManager
   */
  public static getInstance(config?: StagehandConfig): StagehandSessionManager {
    if (!StagehandSessionManager.instance) {
      if (!config) {
        throw new Error("Config is required for first initialization");
      }
      StagehandSessionManager.instance = new StagehandSessionManager(config);
    }
    return StagehandSessionManager.instance;
  }

  /**
   * Create Stagehand configuration with captcha solving settings
   */
  private createStagehandConfig() {
    const {
      apiKey,
      projectId,
      anthropicApiKey,
      modelName = "claude-3-7-sonnet-latest",
      enableCaptchaSolving = true,
      enableAdvancedStealth = false,
      viewportWidth = 1280,
      viewportHeight = 720,
    } = this.config;

    const browserSettings: any = {
      blockAds: true,
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
      },
    };

    if (enableCaptchaSolving) {
      browserSettings.solveCaptchas = true;
    }

    if (enableAdvancedStealth) {
      browserSettings.advancedStealth = true;
    }

    return {
      apiKey,
      projectId,
      env: "BROWSERBASE" as const,
      disablePino: true,
      model: {
        modelName: modelName as any,
        apiKey: anthropicApiKey,
      },
      waitForCaptchaSolves: enableCaptchaSolving,
      browserbaseSessionCreateParams: {
        projectId,
        proxies: enableCaptchaSolving, // Enable proxies when captcha solving is enabled
        browserSettings,
      },
    };
  }

  /**
   * Ensure Stagehand is initialized and return the instance
   */
  public async ensureStagehand(): Promise<Stagehand> {
    this.lastUsed = Date.now();

    try {
      // Initialize if not already initialized
      if (!this.stagehand || !this.initialized) {
        console.log("Creating new Stagehand instance");
        this.stagehand = new Stagehand(this.createStagehandConfig());

        try {
          console.log("Initializing Stagehand...");
          await this.stagehand.init();
          console.log("Stagehand initialized successfully");
          this.initialized = true;
          return this.stagehand;
        } catch (initError) {
          console.error("Failed to initialize Stagehand:", initError);
          throw initError;
        }
      }

      try {
        const page = this.stagehand.context.activePage();
        if (!page) throw new Error("No active page");
        const title = await page.evaluate(() => document.title);
        console.log("Session check successful, page title:", title);
        return this.stagehand;
      } catch (error) {
        // If we get an error indicating the session is invalid, reinitialize
        console.error("Session check failed:", error);
        if (
          error instanceof Error &&
          (error.message.includes("Target page, context or browser has been closed") ||
            error.message.includes("Session expired") ||
            error.message.includes("context destroyed") ||
            error.message.includes("No active page"))
        ) {
          console.log("Browser session expired, reinitializing Stagehand...");
          this.stagehand = new Stagehand(this.createStagehandConfig());
          await this.stagehand.init();
          this.initialized = true;
          return this.stagehand;
        }
        throw error; // Re-throw if it's a different type of error
      }
    } catch (error) {
      this.initialized = false;
      this.stagehand = null;
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to initialize/reinitialize Stagehand: ${errorMsg}`);
    }
  }

  /**
   * Close the Stagehand session if it's been idle for too long
   */
  private async checkAndCleanupSession(): Promise<void> {
    if (!this.stagehand || !this.initialized) return;

    const now = Date.now();
    if (now - this.lastUsed > this.sessionTimeout) {
      console.log("Cleaning up idle Stagehand session");
      try {
        await this.stagehand.close();
      } catch (error) {
        console.error(`Error closing idle session: ${error}`);
      }
      this.stagehand = null;
      this.initialized = false;
    }
  }

  /**
   * Manually close the session
   */
  public async close(): Promise<void> {
    if (this.stagehand) {
      try {
        await this.stagehand.close();
      } catch (error) {
        console.error(`Error closing Stagehand session: ${error}`);
      }
      this.stagehand = null;
      this.initialized = false;
    }
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Get the current Stagehand page instance
   */
  public async getPage() {
    const stagehand = await this.ensureStagehand();
    const page = stagehand.context.activePage();
    if (!page) throw new Error("No active page available");
    return page;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  public static reset(): void {
    if (StagehandSessionManager.instance) {
      StagehandSessionManager.instance.close();
      StagehandSessionManager.instance = null as any;
    }
  }
}

/**
 * Browser action functions that use the session manager
 */
export async function performWebAction(
  sessionManager: StagehandSessionManager,
  url?: string,
  action?: string
) {
  const stagehand = await sessionManager.ensureStagehand();

  try {
    // Navigate to the URL if provided
    if (url) {
      const page = stagehand.context.activePage();
      if (!page) throw new Error("No active page");
      await page.goto(url);
    }

    // Perform the action
    if (action) {
      await stagehand.act(action);
    }

    return {
      success: true,
      message: `Successfully performed: ${action}`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Stagehand action failed: ${errorMessage}`);
  }
}

export async function performWebObservation(
  sessionManager: StagehandSessionManager,
  url?: string,
  instruction?: string
) {
  console.log(`Starting observation${url ? ` for ${url}` : ""} with instruction: ${instruction}`);

  try {
    const stagehand = await sessionManager.ensureStagehand();
    if (!stagehand) {
      console.error("Failed to get Stagehand instance");
      throw new Error("Failed to get Stagehand instance");
    }

    try {
      // Navigate to the URL if provided
      if (url) {
        console.log(`Navigating to ${url}`);
        const page = stagehand.context.activePage();
        if (!page) throw new Error("No active page");
        await page.goto(url);
        console.log(`Successfully navigated to ${url}`);
      }

      // Observe the page
      if (instruction) {
        console.log(`Observing with instruction: ${instruction}`);
        try {
          const actions = await stagehand.observe(instruction);
          console.log(`Observation successful, found ${actions.length} actions`);
          return actions;
        } catch (observeError) {
          console.error("Error during observation:", observeError);
          throw observeError;
        }
      }

      return [];
    } catch (pageError) {
      console.error("Error in page operation:", pageError);
      throw pageError;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Full stack trace for observation error:`, error);
    throw new Error(`Stagehand observation failed: ${errorMessage}`);
  }
}

export async function performWebExtraction(
  sessionManager: StagehandSessionManager,
  url?: string,
  instruction?: string,
  schemaObj?: Record<string, z.ZodTypeAny>,
) {
  console.log(`Starting extraction${url ? ` for ${url}` : ""} with instruction: ${instruction}`);

  try {
    const stagehand = await sessionManager.ensureStagehand();

    try {
      // Navigate to the URL if provided
      if (url) {
        console.log(`Navigating to ${url}`);
        const page = stagehand.context.activePage();
        if (!page) throw new Error("No active page");
        await page.goto(url);
        console.log(`Successfully navigated to ${url}`);
      }

      // Extract data
      if (instruction) {
        console.log(`Extracting with instruction: ${instruction}`);

        // Create a default schema if none is provided
        const { z } = await import("zod");
        const finalSchemaObj = schemaObj || { content: z.string() };
        const schema = z.object(finalSchemaObj);

        try {
          const result = await stagehand.extract(instruction, schema);

          console.log(`Extraction successful:`, result);
          return result;
        } catch (extractError) {
          console.error("Error during extraction:", extractError);
          throw extractError;
        }
      }

      return null;
    } catch (pageError) {
      console.error("Error in page operation:", pageError);
      throw pageError;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Full stack trace for extraction error:`, error);
    throw new Error(`Stagehand extraction failed: ${errorMessage}`);
  }
}

export async function performWebNavigation(
  sessionManager: StagehandSessionManager,
  url: string
) {
  try {
    const stagehand = await sessionManager.ensureStagehand();
    const page = stagehand.context.activePage();
    if (!page) throw new Error("No active page");

    // Navigate to the URL
    await page.goto(url);

    // Get page title and current URL
    const title = await page.evaluate(() => document.title);
    const currentUrl = page.url();

    return {
      success: true,
      title,
      currentUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Navigation failed: ${errorMessage}`,
    };
  }
}

export async function takeScreenshot(
  sessionManager: StagehandSessionManager,
  options?: {
    fullPage?: boolean;
    selector?: string;
  }
) {
  try {
    const stagehand = await sessionManager.ensureStagehand();
    const page = stagehand.context.activePage();
    if (!page) throw new Error("No active page");

    let screenshotBuffer: Buffer;

    if (options?.selector) {
      // Use evaluate to find the element and take a targeted screenshot
      screenshotBuffer = await page.screenshot({ fullPage: false });
    } else {
      screenshotBuffer = await page.screenshot({ fullPage: options?.fullPage });
    }

    return screenshotBuffer;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Screenshot failed: ${errorMessage}`);
  }
}
