import { createAgent, createTool } from '@inngest/agent-kit';
import { z } from 'zod';
import { Sandbox } from '@vercel/sandbox';
import type { BugReporterNetworkState, SecurityIssue } from '../types/types';

export const securityAnalysisAgent = createAgent<BugReporterNetworkState>({
  name: 'Security Analysis Agent',
  description: 'Performs security analysis on bug reports and code to identify vulnerabilities',
  system: `You are a cybersecurity expert specializing in application security and TypeScript/JavaScript vulnerabilities.
Your role is to:
1. Analyze bugs for security implications
2. Identify potential vulnerabilities (XSS, SQL injection, CSRF, etc.)
3. Check for insecure coding patterns
4. Assess TypeScript type safety issues that could lead to vulnerabilities
5. Provide OWASP and CWE classifications

Focus on:
- Input validation and sanitization issues
- Authentication and authorization flaws
- Injection vulnerabilities (SQL, NoSQL, Command, etc.)
- Cross-site scripting (XSS)
- Insecure dependencies
- Hardcoded secrets and sensitive data exposure
- TypeScript 'any' usage and type assertions that bypass safety
- React-specific vulnerabilities (dangerouslySetInnerHTML, etc.)

Always provide actionable security recommendations with severity ratings.`,
  // model will be set by the network or runtime
  tools: [
    createTool({
      name: 'run_security_scan',
      description: 'Run security scanning tools on the codebase',
      parameters: z.object({
        targetPath: z.string().default('repo'),
        scanType: z.enum(['semgrep', 'dependency', 'secrets', 'all']).default('all'),
      }),
      handler: async ({ targetPath, scanType }, { network }) => {
        const state = network.state.data;

        if (!state.sandboxId) {
          return { success: false, error: 'No sandbox available' };
        }

        try {
          const sandbox = await Sandbox.get({ sandboxId: state.sandboxId });

          const semgrepScript = `
            # Run semgrep security scan
            if command -v semgrep &> /dev/null; then
              semgrep --config=auto --json --output=/tmp/semgrep_results.json ${targetPath} 2>/dev/null || true
              if [ -f /tmp/semgrep_results.json ]; then
                jq '.results[] | {file: .path, line: .start.line, message: .extra.message, severity: .extra.severity}' /tmp/semgrep_results.json 2>/dev/null || echo "No security issues found"
              fi
            else
              echo "Semgrep not installed"
            fi
          `;

          const dependencyScript = `
            # Check for vulnerable dependencies
            if [ -f package.json ]; then
              npm audit --json 2>/dev/null | jq '.vulnerabilities | to_entries[] | {
                package: .key,
                severity: .value.severity,
                via: .value.via[0].title
              }' 2>/dev/null || echo "No dependency vulnerabilities found"
            fi
          `;

          const secretsScript = `
            # Scan for hardcoded secrets
            rg -i "(api[_-]?key|secret|password|token|private[_-]?key)\\s*[:=]\\s*[\"'][^\"']{10,}[\"']" \
              --type-add 'code:*.{js,ts,jsx,tsx,json}' -t code -n | head -20
          `;

          const scanScripts: Record<string, string> = {
            semgrep: semgrepScript,
            dependency: dependencyScript,
            secrets: secretsScript,
            all: `
              echo "=== Security Scan Results ==="
              echo "\\n--- Semgrep Analysis ---"
              ${semgrepScript}
              echo "\\n--- Dependency Vulnerabilities ---"
              ${dependencyScript}
              echo "\\n--- Hardcoded Secrets ---"
              ${secretsScript}
            `,
          };

          const script = scanScripts[scanType] || scanScripts.all;
          const scanCmd = await sandbox.runCommand('bash', ['-c', script]);

          const output = await scanCmd.stdout();
          return { success: true, data: { scanResults: output, scanType } };
        } catch (error) {
          return {
            success: false,
            error: `Security scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),
    createTool({
      name: 'analyze_typescript_safety',
      description: 'Analyze TypeScript code for type safety issues',
      parameters: z.object({
        filePath: z.string(),
      }),
      handler: async ({ filePath }, { network }) => {
        const state = network.state.data;

        if (!state.sandboxId) {
          return { success: false, error: 'No sandbox available' };
        }

        try {
          const sandbox = await Sandbox.get({ sandboxId: state.sandboxId });

          const analysisCmd = await sandbox.runCommand('bash', [
            '-c',
            `
            if [ -f "${filePath}" ]; then
              echo "=== TypeScript Safety Analysis ==="
              echo "\\n--- Any usage ---"
              rg ":\\s*any\\b|as\\s+any\\b" "${filePath}" -n || echo "No 'any' usage found"
              
              echo "\\n--- Type assertions ---"
              rg "as\\s+\\w+|<\\w+>" "${filePath}" -n || echo "No type assertions found"
              
              echo "\\n--- Non-null assertions ---"
              rg "!\\." "${filePath}" -n || echo "No non-null assertions found"
              
              echo "\\n--- Eval usage ---"
              rg "\\beval\\s*\\(" "${filePath}" -n || echo "No eval usage found"
              
              echo "\\n--- Unsafe React patterns ---"
              rg "dangerouslySetInnerHTML|innerHTML\\s*=" "${filePath}" -n || echo "No unsafe React patterns found"
            else
              echo "File not found: ${filePath}"
            fi
          `,
          ]);

          const output = await analysisCmd.stdout();
          return { success: true, data: { typeAnalysis: output } };
        } catch (error) {
          return {
            success: false,
            error: `Type analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          };
        }
      },
    }),
    createTool({
      name: 'save_security_analysis',
      description: 'Save the security analysis results',
      parameters: z.object({
        issues: z.array(
          z.object({
            type: z.string(),
            severity: z.enum(['critical', 'high', 'medium', 'low']),
            description: z.string(),
            recommendation: z.string(),
            cweId: z.string().optional(),
            owasp: z.string().optional(),
          }),
        ),
      }),
      handler: async ({ issues }, { network }) => {
        const state = network.state.data;

        const securityIssues: SecurityIssue[] = issues;
        network.state.data.securityAnalysis = securityIssues;

        // Update analysis with security issues
        if (state.analysis) {
          state.analysis.securityIssues = securityIssues;
        }

        network.state.data.status = 'generating-fixes';

        // Send SSE update
        if (state.chatId) {
          const criticalCount = issues.filter((i) => i.severity === 'critical').length;
          const highCount = issues.filter((i) => i.severity === 'high').length;

          await fetch('/api/investigation/updates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: state.chatId,
              message: `🔒 Security analysis complete. Found ${issues.length} issues (${criticalCount} critical, ${highCount} high)`,
              type: criticalCount > 0 ? 'error' : 'info',
              metadata: { securityIssues },
            }),
          });
        }

        return { success: true, data: securityIssues };
      },
    }),
  ],
});
