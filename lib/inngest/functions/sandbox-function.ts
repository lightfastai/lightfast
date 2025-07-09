import { Sandbox } from '@vercel/sandbox';
import ms from 'ms';
import { inngest } from '../client';

export const sandboxFunction = inngest.createFunction(
  { id: 'vercel-sandbox-demo', name: 'Vercel Sandbox Demo' },
  { event: 'sandbox/execute' },
  async ({ event, step }) => {
    const { code, language = 'js' } = event.data;

    let sandboxId: string | null = null;

    try {
      // Create a new sandbox instance
      sandboxId = await step.run('create-sandbox', async () => {
        const sandbox = await Sandbox.create({
          timeout: ms('5m'),
          runtime: 'node22',
        });
        return sandbox.sandboxId;
      });

      // Execute the code in the sandbox
      const result = await step.run('execute-code', async () => {
        // Get the sandbox instance
        const sandbox = await Sandbox.get({ sandboxId: sandboxId! });

        if (language === 'js' || language === 'javascript') {
          // Write the code to a file in the current directory
          const fileName = 'script.js';
          await sandbox.writeFiles([
            {
              path: fileName,
              content: Buffer.from(code),
            },
          ]);

          // Execute the script
          const cmd = await sandbox.runCommand('node', [fileName]);

          // Get output
          const stdout = await cmd.stdout();
          const stderr = await cmd.stderr();

          return {
            stdout: stdout || '',
            stderr: stderr || '',
            exitCode: cmd.exitCode,
          };
        } else if (language === 'bash') {
          // For bash, execute directly
          const cmd = await sandbox.runCommand('bash', ['-c', code]);

          const stdout = await cmd.stdout();
          const stderr = await cmd.stderr();

          return {
            stdout: stdout || '',
            stderr: stderr || '',
            exitCode: cmd.exitCode,
          };
        } else {
          throw new Error(`Unsupported language: ${language}`);
        }
      });

      return {
        success: result.exitCode === 0,
        result: result.stdout,
        error:
          result.stderr ||
          (result.exitCode !== 0 ? `Process exited with code ${result.exitCode}` : ''),
        language,
        exitCode: result.exitCode,
      };
    } catch (error) {
      console.error('Sandbox execution error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        language,
        result: '',
      };
    } finally {
      // Clean up the sandbox
      if (sandboxId) {
        await step.run('cleanup-sandbox', async () => {
          try {
            const sandbox = await Sandbox.get({ sandboxId: sandboxId! });
            await sandbox.stop();
          } catch (err) {
            console.error('Error cleaning up sandbox:', err);
          }
        });
      }
    }
  },
);
