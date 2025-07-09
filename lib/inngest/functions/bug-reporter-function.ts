import { Sandbox } from '@vercel/sandbox';
import ms from 'ms';
import { anthropic } from '@ai-sdk/anthropic';
import { inngest } from '../client';
import { createSSEStep } from '../helpers/sse-wrapper';
import { bugReporterNetwork } from '@/lib/agent-kit/networks/bug-reporter-network';
import type { BugReport, BugReporterNetworkState } from '@/lib/agent-kit/types/types';

export const bugReporterFunction = inngest.createFunction(
  {
    id: 'bug-reporter',
    name: 'Bug Reporter with AgentKit',
    concurrency: {
      limit: 5,
    },
  },
  { event: 'bug/report' },
  async ({ event, step }) => {
    const { bugReport, repository, chatId } = event.data as {
      bugReport: BugReport;
      repository: string;
      chatId: string;
    };
    
    // Create SSE-wrapped step for automatic event emission
    const sseStep = createSSEStep(step, { 
      chatId, 
      functionName: 'bug-reporter' 
    });

    // Step 1: Create and initialize sandbox
    const sandboxId = await sseStep.run('create-bug-analysis-sandbox', async () => {
      const sandbox = await Sandbox.create({
        timeout: ms('20m'),
        runtime: 'node22',
        resources: {
          vcpus: 4,
        },
      });
      console.log('Created bug analysis sandbox:', sandbox.sandboxId);
      return sandbox.sandboxId;
    });

    // Step 2: Clone repository if provided
    if (repository) {
      await sseStep.run('clone-repository-for-analysis', async () => {
        const sandbox = await Sandbox.get({ sandboxId });
        
        // Install git if needed
        const gitCheck = await sandbox.runCommand('which', ['git']);
        if (gitCheck.exitCode !== 0) {
          const installCmd = await sandbox.runCommand({
            cmd: 'dnf',
            args: ['install', '-y', 'git'],
            sudo: true,
          });
          await installCmd.stdout();
        }
        
        // Clone the repository
        const cloneCmd = await sandbox.runCommand('git', ['clone', repository, 'repo']);
        const cloneOutput = await cloneCmd.stdout();
        const cloneError = await cloneCmd.stderr();

        if (cloneCmd.exitCode !== 0) {
          throw new Error(`Failed to clone repository: ${cloneError || 'Unknown error'}`);
        }

        return { success: true, output: cloneOutput };
      });
    }

    // Step 3: Install analysis tools
    await sseStep.run('install-analysis-tools', async () => {
      const sandbox = await Sandbox.get({ sandboxId });
      
      const installScript = `
#!/bin/bash
# Install Python and pip if needed
if ! command -v python3 &> /dev/null; then
  sudo dnf install -y python3 python3-pip
fi

# Install semgrep
if ! command -v semgrep &> /dev/null; then
  python3 -m pip install semgrep --quiet
fi

# Install ripgrep
if ! command -v rg &> /dev/null; then
  sudo dnf install -y ripgrep
fi

echo "Analysis tools installed successfully"
`;
      
      await sandbox.writeFiles([{
        path: 'install_tools.sh',
        content: Buffer.from(installScript)
      }]);
      
      const installCmd = await sandbox.runCommand('bash', ['install_tools.sh']);
      const output = await installCmd.stdout();
      
      return { success: true, output };
    });

    // Step 4: Run AgentKit network analysis
    const analysisResult = await sseStep.run('run-agentkit-analysis', async () => {
      // Initialize network state
      const initialState: BugReporterNetworkState = {
        bugReport,
        sandboxId,
        chatId,
        status: 'analyzing'
      };
      
      // Run the network
      const result = await bugReporterNetwork.run(
        `Analyze this bug report and provide comprehensive analysis with security checks and code fixes:
        
Title: ${bugReport.title}
Description: ${bugReport.description}
Category: ${bugReport.category}
Severity: ${bugReport.severity}
${bugReport.filePath ? `File: ${bugReport.filePath}` : ''}
${bugReport.lineNumber ? `Line: ${bugReport.lineNumber}` : ''}
${bugReport.codeSnippet ? `Code:\n${bugReport.codeSnippet}` : ''}
${bugReport.stackTrace ? `Stack Trace:\n${bugReport.stackTrace}` : ''}`,
        {
          state: initialState
        }
      );
      
      return result;
    });

    // Step 5: Generate comprehensive report
    const report = await sseStep.run('generate-report', async () => {
      const sandbox = await Sandbox.get({ sandboxId });
      
      const finalState = analysisResult.state.data;
      const reportContent = `
# Bug Analysis Report

## Bug Information
- **Title**: ${bugReport.title}
- **Category**: ${bugReport.category}
- **Severity**: ${bugReport.severity}
- **Repository**: ${repository || 'N/A'}

## Analysis Summary
${finalState.analysis?.rootCause || 'No root cause identified'}

## Security Issues Found
${finalState.securityAnalysis?.map((issue) => 
  `- **${issue.type}** (${issue.severity}): ${issue.description}`
).join('\n') || 'No security issues found'}

## Suggested Fixes
${finalState.suggestedFixes?.map((fix: any, i: number) => 
  `### Fix ${i + 1}: ${fix.description}
- **Confidence**: ${fix.confidence}
- **File**: ${fix.filePath}
- **Explanation**: ${fix.explanation}`
).join('\n\n') || 'No fixes suggested'}

---
Generated at: ${new Date().toISOString()}
`;
      
      await sandbox.writeFiles([{
        path: '/tmp/bug_report.md',
        content: Buffer.from(reportContent)
      }]);
      
      await sseStep.sendEvent('send-report', {
        name: 'investigation/update',
        data: {
          chatId,
          message: '📊 Bug analysis report generated',
          type: 'success',
          metadata: { 
            report: reportContent,
            analysis: finalState.analysis,
            securityIssues: finalState.securityAnalysis,
            suggestedFixes: finalState.suggestedFixes
          }
        }
      });
      
      return reportContent;
    });

    // Cleanup
    await sseStep.run('cleanup-sandbox', async () => {
      try {
        const sandbox = await Sandbox.get({ sandboxId });
        await sandbox.stop();
        console.log('Cleaned up bug analysis sandbox:', sandboxId);
      } catch (err) {
        console.error('Error cleaning up sandbox:', err);
      }
    });

    return {
      success: true,
      sandboxId,
      chatId,
      analysis: analysisResult.state.data.analysis,
      securityIssues: analysisResult.state.data.securityAnalysis,
      suggestedFixes: analysisResult.state.data.suggestedFixes,
      report
    };
  }
);