import { agentFunction } from './agent-function';
import { sandboxFunction } from './sandbox-function';

// Export all functions to be served by the Inngest API
export const functions = [sandboxFunction, agentFunction];
