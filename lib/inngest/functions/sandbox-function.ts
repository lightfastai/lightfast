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
          // Write the code to a file and execute it
          await sandbox.writeFiles([
            {
              path: '/tmp/script.js',
              content: Buffer.from(code),
            },
          ]);
          const cmd = await sandbox.runCommand('node', ['/tmp/script.js']);
          const stdout = await cmd.stdout();
          const stderr = await cmd.stderr();
          return {
            stdout,
            stderr,
            exitCode: cmd.exitCode,
          };
        } else if (language === 'bash') {
          // Execute bash commands directly
          const cmd = await sandbox.runCommand('bash', ['-c', code]);
          const stdout = await cmd.stdout();
          const stderr = await cmd.stderr();
          return {
            stdout,
            stderr,
            exitCode: cmd.exitCode,
          };
        } else {
          throw new Error(`Unsupported language: ${language}`);
        }
      });

      return {
        success: true,
        result: result.stdout,
        error: result.stderr,
        language,
        exitCode: result.exitCode,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        language,
      };
    } finally {
      // Clean up the sandbox
      if (sandboxId) {
        await step.run('cleanup-sandbox', async () => {
          const sandbox = await Sandbox.get({ sandboxId: sandboxId! });
          await sandbox.stop();
        });
      }
    }
  },
);
