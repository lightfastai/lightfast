import { Sandbox } from '@vercel/sandbox';

export interface SandboxExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  duration: number;
}

export class SandboxExecutor {
  private sandbox: Sandbox | null = null;

  async initialize(): Promise<void> {
    if (!this.sandbox) {
      this.sandbox = await Sandbox.create();
    }
  }

  async setupEnvironment(packageJson: object, setupScript: string): Promise<SandboxExecutionResult> {
    const startTime = Date.now();
    
    try {
      await this.initialize();
      
      // Write package.json
      await this.sandbox!.writeFiles([
        {
          path: '/vercel/sandbox/package.json',
          content: Buffer.from(JSON.stringify(packageJson, null, 2)),
        },
      ]);
      
      // Install dependencies
      const installResult = await this.sandbox!.runCommand({
        cmd: 'npm',
        args: ['install'],
        cwd: '/vercel/sandbox',
      });
      
      if (installResult.exitCode !== 0) {
        return {
          success: false,
          error: `Failed to install dependencies: ${await installResult.stderr()}`,
          exitCode: installResult.exitCode,
          duration: Date.now() - startTime,
        };
      }
      
      // Write and execute setup script
      await this.sandbox!.writeFiles([
        {
          path: '/vercel/sandbox/setup.js',
          content: Buffer.from(setupScript),
        },
      ]);
      const setupResult = await this.sandbox!.runCommand({
        cmd: 'node',
        args: ['setup.js'],
        cwd: '/vercel/sandbox',
      });
      
      return {
        success: setupResult.exitCode === 0,
        output: await setupResult.stdout(),
        error: (await setupResult.stderr()) || undefined,
        exitCode: setupResult.exitCode,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during setup',
        duration: Date.now() - startTime,
      };
    }
  }

  async executeScript(scriptName: string, scriptContent: string): Promise<SandboxExecutionResult> {
    const startTime = Date.now();
    
    try {
      await this.initialize();
      
      // Write script to sandbox
      await this.sandbox!.writeFiles([
        {
          path: `/vercel/sandbox/${scriptName}`,
          content: Buffer.from(scriptContent),
        },
      ]);
      
      // Execute script
      const result = await this.sandbox!.runCommand({
        cmd: 'node',
        args: [scriptName],
        cwd: '/vercel/sandbox',
      });
      
      return {
        success: result.exitCode === 0,
        output: await result.stdout(),
        error: (await result.stderr()) || undefined,
        exitCode: result.exitCode,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during execution',
        duration: Date.now() - startTime,
      };
    }
  }

  async cleanup(): Promise<void> {
    if (this.sandbox) {
      // Sandbox is cleaned up automatically
      this.sandbox = null;
    }
  }
}