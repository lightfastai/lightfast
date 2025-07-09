import { createAgent, createTool } from '@inngest/agent-kit';
import { z } from 'zod';
import type { BugReporterNetworkState, CodeFix } from '../types';
import { Sandbox } from '@vercel/sandbox';

export const codeFixAgent = createAgent<BugReporterNetworkState>({
  name: 'Code Fix Suggestion Agent',
  description: 'Generates code fixes and patches for identified bugs and security issues',
  system: `You are an expert software engineer specializing in bug fixes and code remediation.
Your role is to:
1. Generate precise, working code fixes for identified bugs
2. Provide secure alternatives for vulnerable code patterns
3. Ensure fixes maintain backward compatibility
4. Include comprehensive test suggestions
5. Explain the reasoning behind each fix

Focus on:
- TypeScript best practices and type safety
- React/Next.js patterns and conventions
- Performance optimizations
- Security hardening
- Clean, maintainable code
- Proper error handling
- Edge case considerations

Always provide multiple fix options when possible, with confidence ratings.`,
  // model will be set by the network or runtime
  tools: [
    createTool({
      name: 'generate_fix',
      description: 'Generate a code fix for a specific issue',
      parameters: z.object({
        filePath: z.string(),
        issueDescription: z.string(),
        startLine: z.number(),
        endLine: z.number().optional(),
        fixStrategy: z.enum(['minimal', 'comprehensive', 'refactor']).default('comprehensive'),
      }),
      handler: async (
        { filePath, issueDescription, startLine, endLine, fixStrategy },
        { network },
      ) => {
        const state = network.state.data;

        if (!state.sandboxId) {
          return { success: false, error: 'No sandbox available' };
        }

        try {
          const sandbox = await Sandbox.get({ sandboxId: state.sandboxId });

          // Get the original code
          const extractCmd = await sandbox.runCommand('bash', [
            '-c',
            `
            if [ -f "${filePath}" ]; then
              end_line=${endLine || startLine}
              sed -n "${startLine},\${end_line}p" "${filePath}"
            else
              echo "File not found: ${filePath}"
              exit 1
            fi
          `,
          ]);

          const originalCode = await extractCmd.stdout();

          return {
            success: true,
            data: {
              originalCode,
              filePath,
              startLine,
              endLine: endLine || startLine,
              issueDescription,
              fixStrategy,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: `Failed to extract code: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),
    createTool({
      name: 'validate_fix',
      description: 'Validate a proposed fix by checking syntax and running type checks',
      parameters: z.object({
        filePath: z.string(),
        newCode: z.string(),
        startLine: z.number(),
        endLine: z.number(),
      }),
      handler: async ({ filePath, newCode, startLine, endLine }, { network }) => {
        const state = network.state.data;

        if (!state.sandboxId) {
          return { success: false, error: 'No sandbox available' };
        }

        try {
          const sandbox = await Sandbox.get({ sandboxId: state.sandboxId });

          // Create a temporary file with the fix applied
          const tempFile = `/tmp/fix_validation_${Date.now()}.ts`;

          // Apply the fix to a copy
          const applyCmd = await sandbox.runCommand('bash', [
            '-c',
            `
            cp "${filePath}" "${tempFile}"
            
            # Extract parts before and after the fix
            head -n $((${startLine} - 1)) "${filePath}" > /tmp/before.txt
            tail -n +$((${endLine} + 1)) "${filePath}" > /tmp/after.txt
            
            # Combine with new code
            cat /tmp/before.txt > "${tempFile}"
            echo "${newCode}" >> "${tempFile}"
            cat /tmp/after.txt >> "${tempFile}"
            
            # Run TypeScript check if available
            if command -v tsc &> /dev/null; then
              tsc --noEmit "${tempFile}" 2>&1 || true
            else
              echo "TypeScript compiler not available"
            fi
            
            # Basic syntax check with Node.js
            node -c "${tempFile}" 2>&1 || echo "Syntax check failed"
          `,
          ]);

          const validationResult = await applyCmd.stdout();

          return {
            success: true,
            data: {
              validationResult,
              isValid: !validationResult.includes('error') && !validationResult.includes('failed'),
            },
          };
        } catch (error) {
          return {
            success: false,
            error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),
    createTool({
      name: 'generate_tests',
      description: 'Generate test cases for the code fix',
      parameters: z.object({
        fixDescription: z.string(),
        testFramework: z.enum(['jest', 'vitest', 'mocha']).default('jest'),
      }),
      handler: async ({ fixDescription, testFramework }, { network }) => {
        // This is a placeholder - in a real implementation, you might
        // analyze the code structure and generate appropriate tests
        return {
          success: true,
          data: {
            testSuggestions: [
              `Test that the fix resolves the original issue`,
              `Test edge cases and boundary conditions`,
              `Test error handling scenarios`,
              `Test performance impact of the fix`,
              `Test backward compatibility`,
            ],
            framework: testFramework,
          },
        };
      },
    }),
    createTool({
      name: 'save_fixes',
      description: 'Save the generated code fixes',
      parameters: z.object({
        fixes: z.array(
          z.object({
            description: z.string(),
            filePath: z.string(),
            changes: z.array(
              z.object({
                type: z.enum(['replace', 'add', 'remove']),
                startLine: z.number(),
                endLine: z.number().optional(),
                oldCode: z.string().optional(),
                newCode: z.string().optional(),
              }),
            ),
            explanation: z.string(),
            confidence: z.enum(['high', 'medium', 'low']),
            testSuggestions: z.array(z.string()).optional(),
          }),
        ),
      }),
      handler: async ({ fixes }, { network }) => {
        const state = network.state.data;

        const codeFixes: CodeFix[] = fixes;
        network.state.data.suggestedFixes = codeFixes;
        network.state.data.status = 'complete';

        // Save fixes to sandbox for review
        if (state.sandboxId) {
          try {
            const sandbox = await Sandbox.get({ sandboxId: state.sandboxId });

            // Generate patch files
            for (let i = 0; i < fixes.length; i++) {
              const fix = fixes[i];
              const patchContent = fix.changes
                .map((change) => {
                  return `
File: ${fix.filePath}
Lines: ${change.startLine}-${change.endLine || change.startLine}
Type: ${change.type}
${change.oldCode ? `Old:\n${change.oldCode}` : ''}
${change.newCode ? `New:\n${change.newCode}` : ''}
---
`;
                })
                .join('\n');

              await sandbox.writeFiles([
                {
                  path: `/tmp/fix_${i + 1}.patch`,
                  content: Buffer.from(patchContent),
                },
              ]);
            }
          } catch (error) {
            console.error('Failed to save patches:', error);
          }
        }

        // Send SSE update
        if (state.chatId) {
          await fetch('/api/investigation/updates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: state.chatId,
              message: `✅ Generated ${fixes.length} code fix${fixes.length > 1 ? 'es' : ''} with ${fixes.filter((f) => f.confidence === 'high').length} high-confidence solutions`,
              type: 'success',
              metadata: { fixes: codeFixes },
            }),
          });
        }

        return { success: true, data: codeFixes };
      },
    }),
  ],
});
