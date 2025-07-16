import { Stagehand } from "@browserbasehq/stagehand";
import { env } from "@/env";

export class StagehandSessionManager {
	private static instance: StagehandSessionManager;
	private stagehand: Stagehand | null = null;
	private initialized = false;
	private sessionId: string | null = null;
	private lastUsed = Date.now();
	private readonly sessionTimeout = 10 * 60 * 1000; // 10 minutes

	private constructor() {}

	public static getInstance(): StagehandSessionManager {
		if (!StagehandSessionManager.instance) {
			StagehandSessionManager.instance = new StagehandSessionManager();
		}
		return StagehandSessionManager.instance;
	}

	public async ensureStagehand(): Promise<Stagehand> {
		this.lastUsed = Date.now();

		// Check if we have a valid session
		if (this.stagehand && this.initialized && this.sessionId) {
			// Check if session is still valid (not timed out)
			if (Date.now() - this.lastUsed < this.sessionTimeout) {
				return this.stagehand;
			}
			// Session timed out, close it
			await this.closeSession();
		}

		// Create new session
		await this.createSession();
		return this.stagehand!;
	}

	private async createSession(): Promise<void> {
		console.log("Creating new Stagehand session...");

		this.stagehand = new Stagehand({
			env: "BROWSERBASE", // Use Browserbase environment
			apiKey: env.BROWSERBASE_API_KEY,
			projectId: env.BROWSERBASE_PROJECT_ID,
			enableCaching: true,
			logger: (logLine) => {
				console.log(`[Stagehand ${logLine.level || "info"}]: ${logLine.message}`);
			},
		});

		// Initialize and get session information
		const initResult = await this.stagehand.init();
		this.sessionId = initResult.sessionId;
		this.initialized = true;
		console.log(`Stagehand session created successfully with ID: ${this.sessionId}`);
	}

	public async closeSession(): Promise<void> {
		if (this.stagehand) {
			console.log("Closing Stagehand session...");
			await this.stagehand.close();
			this.stagehand = null;
			this.sessionId = null;
			this.initialized = false;
		}
	}

	public isSessionActive(): boolean {
		return this.initialized && this.stagehand !== null && this.sessionId !== null;
	}

	public getSessionId(): string | null {
		return this.sessionId;
	}

	// Common browser actions
	public async navigateToUrl(url: string): Promise<void> {
		const stagehand = await this.ensureStagehand();
		await stagehand.page.goto(url);
	}

	public async performAction(action: string): Promise<void> {
		const stagehand = await this.ensureStagehand();
		await stagehand.page.act({ action });
	}

	public async observePage(instruction: string): Promise<string> {
		const stagehand = await this.ensureStagehand();
		const observations = await stagehand.page.observe({ instruction });
		// Return the first observation description or empty string if none
		return observations.length > 0 ? observations[0].description : "";
	}

	public async extractFromPage(instruction: string, schema: any): Promise<any> {
		const stagehand = await this.ensureStagehand();
		const result = await stagehand.page.extract({ instruction, schema });
		return result.extracted;
	}

	// Cleanup method to be called on process exit
	public async cleanup(): Promise<void> {
		await this.closeSession();
	}
}

// Export singleton instance
export const stagehandManager = StagehandSessionManager.getInstance();

// Cleanup on process exit
process.on("exit", () => {
	stagehandManager.cleanup();
});

process.on("SIGINT", async () => {
	await stagehandManager.cleanup();
	process.exit(0);
});

process.on("SIGTERM", async () => {
	await stagehandManager.cleanup();
	process.exit(0);
});
