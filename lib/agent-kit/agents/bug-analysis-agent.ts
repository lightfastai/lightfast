import { createAgent, createTool } from '@inngest/agent-kit';
import { z } from 'zod';
import type { BugAnalysis, BugReporterNetworkState } from '../types/types';
import { Sandbox } from '@vercel/sandbox';

export const bugAnalysisAgent = createAgent<BugReporterNetworkState>({
  name: 'Bug Analysis Agent',
  description:
    'Analyzes bug reports to identify root causes, affected files, and impact assessment',
  system: `You are an expert software engineer specializing in bug analysis and debugging.
Your role is to:
1. Analyze bug reports to identify root causes
2. Determine the scope and impact of bugs
3. Identify affected files and components
4. Assess the severity and priority of issues
5. Look for patterns and related issues

Focus on:
- TypeScript/JavaScript specific issues
- React/Next.js framework issues
- Performance problems
- Logic errors
- Type safety violations
- Memory leaks and resource management

Always provide thorough, actionable analysis with clear explanations.`,
  // model will be set by the network or runtime
  tools: [
    createTool({
      name: 'analyze_code_context',
      description: 'Analyze the code context around the bug location',
      parameters: z.object({
        filePath: z.string(),
        lineNumber: z.number().optional(),
        contextLines: z.number().default(50),
      }),
      handler: async ({ filePath, lineNumber, contextLines }, { network }) => {
        const state = network.state.data;

        if (!state.sandboxId) {
          return { success: false, error: 'No sandbox available' };
        }

        try {
          const sandbox = await Sandbox.get({ sandboxId: state.sandboxId });

          // Read the file and extract context
          const readCmd = await sandbox.runCommand('bash', [
            '-c',
            `
            if [ -f "${filePath}" ]; then
              # Get total lines
              total_lines=$(wc -l < "${filePath}")
              
              # Calculate start and end lines
              if [ -n "${lineNumber}" ]; then
                start=$((${lineNumber} - ${contextLines}))
                end=$((${lineNumber} + ${contextLines}))
              else
                start=1
                end=$total_lines
              fi
              
              # Ensure bounds
              [ $start -lt 1 ] && start=1
              [ $end -gt $total_lines ] && end=$total_lines
              
              # Extract with line numbers
              sed -n "\${start},\${end}p" "${filePath}" | nl -v \$start
            else
              echo "File not found: ${filePath}"
              exit 1
            fi
          `,
          ]);

          const output = await readCmd.stdout();
          return { success: true, data: { context: output, filePath } };
        } catch (error) {
          return {
            success: false,
            error: `Failed to analyze context: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),
    createTool({
      name: 'search_related_issues',
      description: 'Search for similar patterns or related issues in the codebase',
      parameters: z.object({
        pattern: z.string(),
        fileTypes: z.array(z.string()).default(['ts', 'tsx', 'js', 'jsx']),
      }),
      handler: async ({ pattern, fileTypes }, { network }) => {
        const state = network.state.data;

        if (!state.sandboxId) {
          return { success: false, error: 'No sandbox available' };
        }

        try {
          const sandbox = await Sandbox.get({ sandboxId: state.sandboxId });

          // Search for related patterns
          const extensions = fileTypes.map((ext) => `--include="*.${ext}"`).join(' ');
          const searchCmd = await sandbox.runCommand('bash', [
            '-c',
            `
            rg "${pattern}" ${extensions} --line-number --with-filename --max-count=10 | head -50
          `,
          ]);

          const output = await searchCmd.stdout();
          return { success: true, data: { matches: output } };
        } catch (error) {
          return {
            success: false,
            error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),
    createTool({
      name: 'save_analysis',
      description: 'Save the bug analysis results',
      parameters: z.object({
        analysis: z.object({
          rootCause: z.string().optional(),
          affectedFiles: z.array(z.string()).optional(),
          relatedIssues: z.array(z.string()).optional(),
          estimatedImpact: z
            .object({
              users: z.enum(['all', 'some', 'few']),
              performance: z.enum(['high', 'medium', 'low', 'none']),
              security: z.enum(['critical', 'high', 'medium', 'low', 'none']),
            })
            .optional(),
        }),
      }),
      handler: async ({ analysis }, { network }) => {
        const state = network.state.data;

        const fullAnalysis: BugAnalysis = {
          bugReport: state.bugReport!,
          ...analysis,
          securityIssues: state.securityAnalysis,
        };

        network.state.data.analysis = fullAnalysis;
        network.state.data.status = 'security-check';

        // Send SSE update
        if (state.chatId) {
          await fetch('/api/investigation/updates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: state.chatId,
              message: `🔍 Bug analysis complete. Root cause identified: ${analysis.rootCause || 'Under investigation'}`,
              type: 'info',
              metadata: { analysis: fullAnalysis },
            }),
          });
        }

        return { success: true, data: fullAnalysis };
      },
    }),
  ],
});
