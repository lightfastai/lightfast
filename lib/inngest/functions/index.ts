import { bugReporterFunction } from './bug-reporter-function';
import { codeSearchAgent } from './code-search-agent';
import { codeSecurityAgent } from './code-security-agent';
import { investigationOrchestrator } from './investigation-orchestrator';
import { updateHandler } from './update-handler';

// Export all functions to be served by the Inngest API
export const functions = [
  bugReporterFunction,
  investigationOrchestrator,
  codeSearchAgent,
  codeSecurityAgent,
  updateHandler,
];
