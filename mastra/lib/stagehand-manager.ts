import { Stagehand } from "@browserbasehq/stagehand";
import { env } from "@/env";

export class StagehandSessionManager {
	private static instance: StagehandSessionManager;
	private stagehand: Stagehand | null = null;
	private initialized = false;
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
		if (this.stagehand && this.initialized) {
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
			browserbaseAPIKey: env.BROWSERBASE_API_KEY,
			browserbaseProjectId: env.BROWSERBASE_PROJECT_ID,
			env: "BROWSERBASE", // Use Browserbase environment
			headless: true,
			enableCaching: true,
			logger: (message: { type: string; message: string }) => {
				console.log(`[Stagehand ${message.type}]: ${message.message}`);
			},
		});

		await this.stagehand.init();
		this.initialized = true;
		console.log("Stagehand session created successfully");
	}

	public async closeSession(): Promise<void> {
		if (this.stagehand) {
			console.log("Closing Stagehand session...");
			await this.stagehand.close();
			this.stagehand = null;
			this.initialized = false;
		}
	}

	public isSessionActive(): boolean {
		return this.initialized && this.stagehand !== null;
	}

	public getSessionId(): string | null {
		return this.stagehand?.sessionId || null;
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
		return await stagehand.page.observe({ instruction });
	}

	public async extractFromPage(instruction: string, schema: any): Promise<any> {
		const stagehand = await this.ensureStagehand();
		return await stagehand.page.extract({ instruction, schema });
	}

	// Cleanup method to be called on process exit
	public async cleanup(): Promise<void> {
		await this.closeSession();
	}
}

// Export singleton instance
export const stagehandManager = StagehandSessionManager.getInstance();

// Cleanup on process exit
process.on('exit', () => {
	stagehandManager.cleanup();
});

process.on('SIGINT', async () => {
	await stagehandManager.cleanup();
	process.exit(0);
});

process.on('SIGTERM', async () => {
	await stagehandManager.cleanup();
	process.exit(0);
});