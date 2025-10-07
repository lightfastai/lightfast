/**
 * Deus Session MCP Server
 *
 * Exposes tools for Claude Code and Codex to interact with the Deus session:
 * - Add/get shared context
 * - Add/update tasks
 * - Update session status
 * - List linked agents
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SessionManager, findLatestSession } from '../lib/session-manager.js';

// Initialize session manager
let sessionManager: SessionManager | null = null;

/**
 * Parse command line arguments
 */
function parseArgs(): { sessionId?: string } {
  const args = process.argv.slice(2);
  let sessionId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--session' && i + 1 < args.length) {
      sessionId = args[i + 1];
      break;
    }
  }

  return { sessionId };
}

async function initializeSessionManager(providedSessionId?: string): Promise<void> {
  let sessionId = providedSessionId;

  // If no session ID provided, try to find the latest session
  if (!sessionId) {
    const latestSessionId = await findLatestSession();
    sessionId = latestSessionId || undefined;
  }

  sessionManager = new SessionManager(sessionId);
  await sessionManager.initialize();

  console.error(`[Deus MCP] Session initialized: ${sessionManager.getSessionId()}`);
}

// Create server instance
const server = new Server(
  {
    name: 'deus-session',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'deus_add_context',
        description: 'Add a key-value pair to the shared Deus session context. This context is accessible by all agents (Claude Code and Codex) in the session.',
        inputSchema: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'The context key',
            },
            value: {
              description: 'The context value (any JSON-serializable type)',
            },
          },
          required: ['key', 'value'],
        },
      },
      {
        name: 'deus_get_session',
        description: 'Get the current Deus session state including linked agents, tasks, shared context, and status.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'deus_add_task',
        description: 'Add a new task to the Deus session. Tasks are visible to all agents and can be tracked across the session.',
        inputSchema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'The task description (imperative form, e.g., "Implement authentication")',
            },
            activeForm: {
              type: 'string',
              description: 'The active form shown during execution (present continuous, e.g., "Implementing authentication")',
            },
          },
          required: ['content', 'activeForm'],
        },
      },
      {
        name: 'deus_update_task',
        description: 'Update an existing task in the Deus session.',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              description: 'The ID of the task to update',
            },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed'],
              description: 'The new status of the task',
            },
            content: {
              type: 'string',
              description: 'Updated task description (optional)',
            },
            activeForm: {
              type: 'string',
              description: 'Updated active form (optional)',
            },
          },
          required: ['taskId'],
        },
      },
      {
        name: 'deus_update_status',
        description: 'Update the Deus session status.',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['active', 'paused', 'awaiting_input', 'completed'],
              description: 'The new session status',
            },
          },
          required: ['status'],
        },
      },
      {
        name: 'deus_list_agents',
        description: 'List all agents (Claude Code and Codex sessions) linked to this Deus session.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (!sessionManager) {
    throw new Error('Session manager not initialized');
  }

  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'deus_add_context': {
        const { key, value } = args as { key: string; value: unknown };
        await sessionManager.shareContext(key, value);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully added context: ${key}`,
            },
          ],
        };
      }

      case 'deus_get_session': {
        const state = sessionManager.getState();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(state, null, 2),
            },
          ],
        };
      }

      case 'deus_add_task': {
        const { content, activeForm } = args as { content: string; activeForm: string };
        const taskId = await sessionManager.addTask(content, activeForm);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully added task with ID: ${taskId}`,
            },
          ],
        };
      }

      case 'deus_update_task': {
        const { taskId, status, content, activeForm } = args as {
          taskId: string;
          status?: 'pending' | 'in_progress' | 'completed';
          content?: string;
          activeForm?: string;
        };

        await sessionManager.updateTask(taskId, { status, content, activeForm });
        return {
          content: [
            {
              type: 'text',
              text: `Successfully updated task: ${taskId}`,
            },
          ],
        };
      }

      case 'deus_update_status': {
        const { status } = args as { status: 'active' | 'paused' | 'awaiting_input' | 'completed' };
        await sessionManager.updateStatus(status);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully updated session status to: ${status}`,
            },
          ],
        };
      }

      case 'deus_list_agents': {
        const agents = sessionManager.getLinkedAgents();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(agents, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  try {
    // Parse command line arguments
    const { sessionId } = parseArgs();

    if (sessionId) {
      console.error(`[Deus MCP] Using session ID from command line: ${sessionId}`);
    }

    // Initialize session manager
    await initializeSessionManager(sessionId);

    // Create stdio transport
    const transport = new StdioServerTransport();

    // Connect server to transport
    await server.connect(transport);

    console.error('[Deus MCP] Server running on stdio');
  } catch (error) {
    console.error('[Deus MCP] Fatal error:', error);
    process.exit(1);
  }
}

main();
