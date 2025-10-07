/**
 * Deus MCP Orchestration Example
 * Demonstrates how to use the MCP orchestration system
 */

import { createMCPOrchestrator, loadMCPOrchestrator } from '../src/lib/mcp-orchestrator.js';
import { listActiveSessions, cleanupOldSessions } from '../src/lib/deus-config.js';

async function main() {
  console.log('=== Deus MCP Orchestration Example ===\n');

  // Example 1: Create a new session
  console.log('Example 1: Creating new orchestration session...\n');

  const orchestrator = await createMCPOrchestrator({
    jobType: 'code-review',
    mcpServers: ['deus-session', 'playwright'],
    repoRoot: process.cwd(),
  });

  // Print session info
  orchestrator.printSessionInfo();

  // Get manual commands for debugging
  console.log('Manual Commands:');
  console.log('----------------');
  console.log('\nClaude Code:');
  console.log(orchestrator.getClaudeCodeCommand());
  console.log('\nCodex:');
  console.log(await orchestrator.getCodexCommand());
  console.log('\n');

  // Example 2: List active sessions
  console.log('Example 2: Listing active sessions...\n');

  const sessions = await listActiveSessions();
  console.log(`Found ${sessions.length} active session(s):`);
  sessions.forEach((session, i) => {
    console.log(`  ${i + 1}. ${session.sessionId} (${session.jobType}) - ${session.createdAt}`);
  });
  console.log('\n');

  // Example 3: Load existing session
  if (sessions.length > 0) {
    console.log('Example 3: Loading existing session...\n');

    const loadedOrch = await loadMCPOrchestrator(sessions[0]!.sessionId);
    loadedOrch.printSessionInfo();
  }

  // Example 4: Start agents (commented out - requires actual CLI tools)
  /*
  console.log('Example 4: Starting agents...\n');

  await orchestrator.startClaudeCode('Review the authentication code in src/auth/');
  await orchestrator.startCodex('Help write unit tests for the auth module');

  // Wait for user to complete work...
  // Then stop agents
  await orchestrator.completeSession();
  */

  // Example 5: Cleanup old sessions
  console.log('Example 5: Cleanup old sessions...\n');
  console.log('Would clean up sessions older than 7 days');
  // await cleanupOldSessions(7); // Uncomment to actually clean up

  console.log('\n=== Example Complete ===');
}

// Run the example
main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
