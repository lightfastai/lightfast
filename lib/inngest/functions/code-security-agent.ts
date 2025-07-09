import { Sandbox } from '@vercel/sandbox';
import { generateText } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { inngest } from '../client';
import { createSSEStep } from '../helpers/sse-wrapper';

const SECURITY_AGENT = {
  system_prompt: '...',
  model: '....',
  timeout: '10s',
};

export const codeSecurityAgent = inngest.createFunction(
  {
    id: 'code-security-agent',
    name: 'Code Security Agent - TypeScript Best Practices',
    concurrency: {
      limit: 5,
    },
  },
  { event: 'security/analyze' },
  async ({ event, step }) => {
    const { sandboxId, repository, securityQuery, chatId, parentEventId } = event.data;

    // Create SSE-wrapped step for automatic event emission
    const sseStep = createSSEStep(step, {
      chatId,
      functionName: 'code-security-agent',
    });

    // Step 1: Generate security analysis script
    const scriptGeneration = await sseStep.run('generate-security-script', async () => {
      const { text } = await generateText({
        model: gateway('anthropic/claude-3-7-sonnet-20250219'),
        system: `You are a TypeScript security expert specializing in identifying vulnerabilities and security best practices.
Generate bash scripts that analyze code for security issues focusing on:

1. TypeScript-specific security patterns:
   - Type assertions and any usage
   - Unsafe type coercions
   - Missing null/undefined checks
   - Improper error handling
   - Weak typing patterns

2. Common security vulnerabilities:
   - SQL injection risks
   - XSS vulnerabilities
   - CSRF vulnerabilities
   - Path traversal
   - Command injection
   - Sensitive data exposure
   - Insecure dependencies

3. Authentication & Authorization:
   - JWT validation
   - Session management
   - Access control patterns
   - API key exposure

4. Data validation:
   - Input sanitization
   - Output encoding
   - Schema validation
   - Type guards usage

5. Cryptography issues:
   - Weak hashing algorithms
   - Hardcoded secrets
   - Insecure random generation
   - Missing encryption

Tools available:
- semgrep for security pattern matching
- ripgrep (rg) for fast searching
- jq for JSON processing
- Standard Unix tools

Output format: Return ONLY the bash script without explanation or markdown blocks.`,
        prompt: `Generate a comprehensive security analysis script for the following:
Query: ${securityQuery || 'Perform a full security audit focusing on TypeScript best practices'}
Repository: ${repository}

The repository is already cloned in the 'repo' directory.
Focus on TypeScript security patterns, common vulnerabilities, and provide actionable recommendations.`,
        temperature: 0.3, // Lower temperature for more consistent security analysis
      });

      return text;
    });

    // Step 2: Execute security analysis
    const analysisResult = await sseStep.run('execute-security-analysis', async () => {
      const sandbox = await Sandbox.get({ sandboxId });

      // Install security tools if needed
      const installScript = `
#!/bin/bash
# Install security analysis tools
if ! command -v semgrep &> /dev/null; then
  echo "Installing semgrep..."
  python3 -m pip install semgrep --quiet
fi

# Create custom TypeScript security rules
cat > /tmp/typescript-security-rules.yaml << 'EOF'
rules:
  - id: typescript-any-usage
    pattern: |
      $X: any
    message: "Avoid using 'any' type - it disables TypeScript's type checking"
    severity: WARNING
    languages: [typescript]

  - id: unsafe-type-assertion
    pattern: |
      $X as $Y
    message: "Type assertion detected - ensure this is safe and necessary"
    severity: INFO
    languages: [typescript]

  - id: eval-usage
    pattern: |
      eval($X)
    message: "eval() is dangerous and can lead to code injection"
    severity: ERROR
    languages: [typescript, javascript]

  - id: hardcoded-secret
    pattern-regex: |
      (api[_-]?key|secret|password|token)\s*=\s*["'][^"']+["']
    message: "Potential hardcoded secret detected"
    severity: ERROR
    languages: [typescript, javascript]

  - id: sql-injection-risk
    pattern: |
      $QUERY = \`SELECT ... WHERE ... \${$USER_INPUT}\`
    message: "Potential SQL injection - use parameterized queries"
    severity: ERROR
    languages: [typescript]

  - id: missing-input-validation
    pattern: |
      req.body.$FIELD
    message: "Direct use of request body - add validation"
    severity: WARNING
    languages: [typescript]
EOF
`;

      // Save and execute installation script
      await sandbox.writeFiles([
        {
          path: 'install_security_tools.sh',
          content: Buffer.from(installScript),
        },
      ]);
      await sandbox.runCommand('chmod', ['+x', 'install_security_tools.sh']);
      await sandbox.runCommand('bash', ['install_security_tools.sh']);

      // Save the main security analysis script
      const scriptName = `security_analysis_${Date.now()}.sh`;
      await sandbox.writeFiles([
        {
          path: scriptName,
          content: Buffer.from(scriptGeneration),
        },
      ]);

      await sandbox.runCommand('chmod', ['+x', scriptName]);

      // Execute the security analysis
      const cmd = await sandbox.runCommand('bash', [scriptName]);
      const stdout = await cmd.stdout();
      const stderr = await cmd.stderr();

      return {
        stdout,
        stderr,
        exitCode: cmd.exitCode,
        script: scriptGeneration,
      };
    });

    // Step 3: Analyze results with AI for TypeScript-specific insights
    const securityReport = await sseStep.run('generate-security-report', async () => {
      const { text } = await generateText({
        model: gateway('anthropic/claude-3-7-sonnet-20250219'),
        system: `You are a TypeScript security expert. Analyze security scan results and provide:
1. Critical vulnerabilities that need immediate attention
2. TypeScript-specific security issues and type safety problems
3. Best practice violations
4. Specific code examples and fixes
5. Priority-ordered action items

Focus on practical, actionable recommendations with TypeScript code examples.`,
        prompt: `Analyze these security scan results for TypeScript best practices:

Query: ${securityQuery || 'Full security audit'}
Scan Output:
${analysisResult.stdout}

${analysisResult.stderr ? `Errors:\n${analysisResult.stderr}` : ''}

Provide a comprehensive security report with:
1. Executive summary of findings
2. Detailed vulnerability analysis
3. TypeScript-specific security recommendations
4. Code examples showing secure patterns
5. Prioritized remediation steps`,
        temperature: 0.5,
      });

      return text;
    });

    // Step 4: Generate secure code patterns
    const securePatterns = await sseStep.run('generate-secure-patterns', async () => {
      const { text } = await generateText({
        model: gateway('anthropic/claude-3-7-sonnet-20250219'),
        system: `You are a TypeScript security expert. Generate secure code patterns and examples.`,
        prompt: `Based on the security findings, generate TypeScript code examples showing:

1. Secure alternatives to identified vulnerabilities
2. Type-safe patterns to replace unsafe code
3. Input validation examples
4. Authentication/authorization patterns
5. Error handling best practices

Original findings:
${securityReport}

Provide practical, copy-paste ready TypeScript code snippets.`,
        temperature: 0.7,
      });

      return text;
    });

    // Step 5: Save comprehensive security report
    await sseStep.run('save-security-report', async () => {
      const sandbox = await Sandbox.get({ sandboxId });

      const fullReport = `
# Security Analysis Report
Generated: ${new Date().toISOString()}
Repository: ${repository}

## Executive Summary
${securityReport}

## Secure Code Patterns
${securePatterns}

## Analysis Details
### Script Used:
\`\`\`bash
${scriptGeneration}
\`\`\`

### Raw Output:
${analysisResult.stdout}

========================================
`;

      // Save the report
      await sandbox.writeFiles([
        {
          path: `/tmp/security_report_${Date.now()}.md`,
          content: Buffer.from(fullReport),
        },
      ]);

      // Send updates to chat
      await sseStep.sendEvent('send-security-summary', {
        name: 'investigation/update',
        data: {
          chatId,
          message: securityReport,
          type: 'result',
          metadata: {
            script: scriptGeneration,
            patterns: securePatterns,
            parentEventId,
          },
        },
      });

      // Send secure patterns as a follow-up
      await sseStep.sendEvent('send-secure-patterns', {
        name: 'investigation/update',
        data: {
          chatId,
          message: `## Secure Code Patterns\n${securePatterns}`,
          type: 'info',
          metadata: {
            parentEventId,
          },
        },
      });
    });

    // Step 6: Check for critical issues requiring immediate action
    const criticalCheck = await sseStep.run('check-critical-issues', async () => {
      const { text } = await generateText({
        model: gateway('anthropic/claude-3-7-sonnet-20250219'),
        system: `Determine if there are critical security issues requiring immediate action.
Return "CRITICAL" if immediate action needed, otherwise "NORMAL".`,
        prompt: `Based on this security report, are there critical issues?
${securityReport}

Consider: exposed secrets, active vulnerabilities, authentication bypasses, etc.`,
        temperature: 0.1,
      });

      if (text.trim() === 'CRITICAL') {
        await sseStep.sendEvent('alert-critical', {
          name: 'investigation/update',
          data: {
            chatId,
            message:
              '🚨 CRITICAL SECURITY ISSUES DETECTED! Immediate action required. See report above.',
            type: 'error',
            metadata: {
              parentEventId,
            },
          },
        });
      }

      return text.trim();
    });

    return {
      success: true,
      script: scriptGeneration,
      output: analysisResult.stdout,
      report: securityReport,
      securePatterns,
      severity: criticalCheck,
    };
  },
);
