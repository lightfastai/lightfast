import { Sandbox } from '@vercel/sandbox';
import { generateText } from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { inngest } from '../client';
import { createSSEStep } from '../helpers/sse-wrapper';

export const codeSearchAgent = inngest.createFunction(
  {
    id: 'code-search-agent',
    name: 'Code Search Agent with LLM',
    concurrency: {
      limit: 10,
    },
  },
  { event: 'investigation/search' },
  async ({ event, step }) => {
    const { sandboxId, repository, searchQuery, chatId, parentEventId } = event.data;

    // Create SSE-wrapped step for automatic event emission
    const sseStep = createSSEStep(step, {
      chatId,
      functionName: 'code-search-agent',
    });

    // The Anthropic API key is validated at build time by T3 Env
    // No need to check it here since the app won't build without it

    // Step 1: Generate bash script for the search query
    const scriptGeneration = await sseStep.run('generate-search-script', async () => {
      const { text } = await generateText({
        model: gateway('anthropic/claude-3-7-sonnet-20250219'),
        system: `You are a code investigation expert. Generate bash scripts to analyze repositories.
Your scripts should:
1. Use standard Unix tools (find, grep, awk, sed, etc.)
2. Be efficient and focused on the search query
3. Output clear, structured results
4. Handle errors gracefully
5. Work within the 'repo' directory that contains the cloned repository

Available tools:
- ripgrep (rg) for fast searching
- jq for JSON processing
- Standard Unix tools

Output format: Return ONLY the bash script without explanation or markdown blocks.`,
        prompt: `Generate a bash script to investigate the following in the repository:
Query: ${searchQuery}
Repository: ${repository}

The repository is already cloned in the 'repo' directory.`,
        temperature: 0.7,
      });

      console.log('Generated script:', text);
      return text;
    });

    // Step 2: Execute the generated script
    const executionResult = await sseStep.run('execute-search-script', async () => {
      const sandbox = await Sandbox.get({ sandboxId });

      // Save the script to a file
      const scriptName = `search_${Date.now()}.sh`;
      await sandbox.writeFiles([
        {
          path: scriptName,
          content: Buffer.from(scriptGeneration),
        },
      ]);

      // Make it executable
      await sandbox.runCommand('chmod', ['+x', scriptName]);

      // Execute the script
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

    // Step 3: Analyze results with LLM
    const analysis = await sseStep.run('analyze-results', async () => {
      const { text } = await generateText({
        model: gateway('anthropic/claude-3-7-sonnet-20250219'),
        system: `You are a code analysis expert. Analyze the output from bash scripts and provide clear, actionable insights.`,
        prompt: `Analyze the following search results:

Query: ${searchQuery}
Script Output:
${executionResult.stdout}

${executionResult.stderr ? `Errors:\n${executionResult.stderr}` : ''}

Provide a clear, concise summary of the findings.`,
        temperature: 0.5,
      });

      return text;
    });

    // Step 4: Save findings and send update
    await sseStep.run('save-and-update', async () => {
      const sandbox = await Sandbox.get({ sandboxId });

      // Append findings to a file
      const findings = `
=== Search Query: ${searchQuery} ===
Generated Script:
${scriptGeneration}

Output:
${executionResult.stdout}

Analysis:
${analysis}

========================================
`;

      await sandbox.runCommand('bash', [
        '-c',
        `echo '${findings.replace(/'/g, "'\\''")}' >> /tmp/investigation_findings.txt`,
      ]);

      // Send update to chat
      await sseStep.sendEvent('send-findings', {
        name: 'investigation/update',
        data: {
          chatId,
          message: analysis,
          type: 'result',
          metadata: {
            script: scriptGeneration,
            output: executionResult.stdout,
            parentEventId,
          },
        },
      });
    });

    // Step 5: Generate follow-up scripts if needed
    const followUp = await sseStep.run('generate-follow-up', async () => {
      const { text } = await generateText({
        model: gateway('anthropic/claude-3-7-sonnet-20250219'),
        system: `You are a code investigation expert. Based on the findings, determine if follow-up investigation is needed.
If yes, generate a specific follow-up query. If no, return "NONE".`,
        prompt: `Based on these findings, should we investigate further?

Original Query: ${searchQuery}
Findings: ${analysis}

If yes, provide a specific follow-up query. If no, return "NONE".`,
        temperature: 0.5,
      });

      if (text.trim() !== 'NONE' && text.length > 10) {
        // Trigger follow-up investigation
        await sseStep.sendEvent('trigger-follow-up', {
          name: 'investigation/search',
          data: {
            sandboxId,
            repository,
            searchQuery: text,
            chatId,
            parentEventId: event.id || parentEventId,
          },
        });
      }

      return text;
    });

    return {
      success: true,
      script: scriptGeneration,
      output: executionResult.stdout,
      analysis,
      followUp: followUp !== 'NONE' ? followUp : null,
    };
  },
);
