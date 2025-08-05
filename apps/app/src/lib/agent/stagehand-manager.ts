import { Stagehand } from "@browserbasehq/stagehand";

interface StagehandConfig {
  apiKey: string;
  projectId: string;
}

export class StagehandSessionManager {
  private static instance: StagehandSessionManager;
  private sessions: Map<string, Stagehand> = new Map();
  private lastUsed: Map<string, number> = new Map();
  private readonly sessionTimeout = 10 * 60 * 1000; // 10 minutes

  private constructor() {
    // Schedule cleanup every minute
    setInterval(() => this.cleanupIdleSessions(), 60 * 1000);
  }

  public static getInstance(): StagehandSessionManager {
    if (!StagehandSessionManager.instance) {
      StagehandSessionManager.instance = new StagehandSessionManager();
    }
    return StagehandSessionManager.instance;
  }

  public async ensureStagehand(sessionId: string, config: StagehandConfig): Promise<Stagehand> {
    this.lastUsed.set(sessionId, Date.now());

    // Check if session exists and is still valid
    const existingSession = this.sessions.get(sessionId);
    if (existingSession) {
      try {
        // Test if session is still alive
        await existingSession.page.evaluate(() => document.title);
        return existingSession;
      } catch (error) {
        // Session is dead, remove it
        this.sessions.delete(sessionId);
      }
    }

    // Create new session
    console.log(`Creating new Stagehand session for ${sessionId}`);
    const stagehand = new Stagehand({
      apiKey: config.apiKey,
      projectId: config.projectId,
      env: "BROWSERBASE",
      disablePino: true,
    });

    await stagehand.init();
    this.sessions.set(sessionId, stagehand);
    
    return stagehand;
  }

  private async cleanupIdleSessions(): Promise<void> {
    const now = Date.now();
    
    for (const [sessionId, lastUsedTime] of this.lastUsed.entries()) {
      if (now - lastUsedTime > this.sessionTimeout) {
        await this.closeSession(sessionId);
      }
    }
  }

  public async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.close();
      } catch (error) {
        console.error(`Error closing session ${sessionId}:`, error);
      }
      this.sessions.delete(sessionId);
      this.lastUsed.delete(sessionId);
    }
  }

  public async closeAllSessions(): Promise<void> {
    for (const sessionId of this.sessions.keys()) {
      await this.closeSession(sessionId);
    }
  }
}