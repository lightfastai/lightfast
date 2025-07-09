import { Sandbox } from '@vercel/sandbox';
import ms from 'ms';
import type { InvestigationResult } from '@/types/inngest';
import { inngest } from '../client';
import { createSSEStep } from '../helpers/sse-wrapper';

export const investigationOrchestrator = inngest.createFunction(
  {
    id: 'investigation-orchestrator',
    name: 'Code Investigation Orchestrator',
    concurrency: {
      limit: 5,
      key: 'event.data.userId',
    },
  },
  { event: 'investigation/start' },
  async ({ event, step }) => {
    const { query, repository, userId, chatId } = event.data;
    
    // Create SSE-wrapped step for automatic event emission
    const sseStep = createSSEStep(step, { 
      chatId, 
      functionName: 'investigation-orchestrator' 
    });

    // Send initial update
    await sseStep.sendEvent('send-update', {
      name: 'investigation/update',
      data: {
        chatId,
        message: `Starting investigation of ${repository}...`,
        type: 'info',
      },
    });

    // Step 1: Create and initialize sandbox
    const sandboxId = await sseStep.run('create-sandbox', async () => {
      const sandbox = await Sandbox.create({
        timeout: ms('30m'), // Longer timeout for investigation
        runtime: 'node22',
        resources: {
          vcpus: 4, // More resources for faster processing
        },
      });
      console.log('Created investigation sandbox:', sandbox.sandboxId);
      return sandbox.sandboxId;
    });

    // Step 2: Check for git and install if needed
    const gitInstalled = await sseStep.run('check-git', async () => {
      const sandbox = await Sandbox.get({ sandboxId });

      try {
        const whichCmd = await sandbox.runCommand('which', ['git']);
        await whichCmd.stdout();
        return true;
      } catch {
        return false;
      }
    });

    if (!gitInstalled) {
      await sseStep.sendEvent('send-git-install-update', {
        name: 'investigation/update',
        data: {
          chatId,
          message: 'Installing git...',
          type: 'info',
        },
      });

      await sseStep.run('install-git', async () => {
        const sandbox = await Sandbox.get({ sandboxId });
        const installCmd = await sandbox.runCommand({
          cmd: 'dnf',
          args: ['install', '-y', 'git'],
          sudo: true,
        });
        await installCmd.stdout();
      });
    }

    const cloneResult = await sseStep.run('clone-repository', async () => {
      const sandbox = await Sandbox.get({ sandboxId });

      // Clone the repository
      const cloneCmd = await sandbox.runCommand('git', ['clone', repository, 'repo']);
      const cloneOutput = await cloneCmd.stdout();
      const cloneError = await cloneCmd.stderr();

      if (cloneCmd.exitCode !== 0) {
        throw new Error(`Failed to clone repository: ${cloneError || 'Unknown error'}`);
      }

      // Get basic repo info
      const repoInfoCmd = await sandbox.runCommand('bash', ['-c', 'cd repo && ls -la']);
      const repoInfo = await repoInfoCmd.stdout();

      return {
        success: true,
        output: cloneOutput,
        repoInfo,
      };
    });
    // Step 3: Clone the repository

    await sseStep.sendEvent('send-clone-complete', {
      name: 'investigation/update',
      data: {
        chatId,
        message: 'Repository cloned successfully. Analyzing structure...',
        type: 'success',
      },
    });

    // Step 4: Initial repository analysis
    await sseStep.sendEvent('trigger-search', {
      name: 'investigation/search',
      data: {
        sandboxId,
        repository,
        searchQuery: `Analyze the repository structure and provide:
1. Main programming languages used
2. Key directories and their purposes
3. Important configuration files
4. Dependencies and build tools`,
        chatId,
        parentEventId: event.id || 'orchestrator',
      },
    });

    // Wait for the analysis to complete
    await sseStep.sleep('wait-for-initial-analysis', ms('10s'));

    // Step 5: Deep investigation based on query
    await sseStep.sendEvent('trigger-deep-search', {
      name: 'investigation/search',
      data: {
        sandboxId,
        repository,
        searchQuery: query,
        chatId,
        parentEventId: event.id || 'orchestrator',
      },
    });

    // Wait for investigation to complete
    await sseStep.sleep('wait-for-investigation', ms('20s'));

    // Step 5.5: Run security analysis if requested
    const shouldRunSecurity =
      query.toLowerCase().includes('security') ||
      query.toLowerCase().includes('vulnerab') ||
      query.toLowerCase().includes('safe');

    if (shouldRunSecurity) {
      await sseStep.sendEvent('trigger-security-analysis', {
        name: 'security/analyze',
        data: {
          sandboxId,
          repository,
          securityQuery: query,
          chatId,
          parentEventId: event.id || 'orchestrator',
        },
      });

      // Wait for security analysis to complete
      await sseStep.sleep('wait-for-security-analysis', ms('15s'));
    }

    // Step 6: Generate summary
    const summary = await sseStep.run('generate-summary', async () => {
      const sandbox = await Sandbox.get({ sandboxId });

      // Collect all findings from the investigation
      const findingsCmd = await sandbox.runCommand('bash', [
        '-c',
        `
        if [ -f /tmp/investigation_findings.txt ]; then
          cat /tmp/investigation_findings.txt
        else
          echo "No findings file generated"
        fi
      `,
      ]);
      const findings = await findingsCmd.stdout();

      await sseStep.sendEvent('send-summary', {
        name: 'investigation/update',
        data: {
          chatId,
          message: "Investigation complete! Here's what I found:",
          type: 'success',
          metadata: {
            findings,
          },
        },
      });

      return findings;
    });

    // Cleanup
    await sseStep.run('cleanup', async () => {
      try {
        const sandbox = await Sandbox.get({ sandboxId });
        await sandbox.stop();
        console.log('Cleaned up investigation sandbox:', sandboxId);
      } catch (err) {
        console.error('Error cleaning up sandbox:', err);
      }
    });

    const result: InvestigationResult = {
      chatId,
      repository,
      findings: [summary],
      scripts: [], // Will be populated by the search agent
      summary: `Investigation of ${repository} completed. Check the chat for detailed findings.`,
    };

    return result;
  },
);
