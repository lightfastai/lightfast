import { EventSchemas, Inngest } from 'inngest';
import { env } from '@/env';
import type {
  AgentQueryEvent,
  CodeInvestigationEvent,
  CodeSearchEvent,
  InvestigationUpdateEvent,
  SandboxExecuteEvent,
  ScriptExecutionEvent,
  SecurityAnalyzeEvent,
} from '@/types/inngest';

// Define type for the events
type Events = {
  'sandbox/execute': {
    data: SandboxExecuteEvent['data'];
  };
  'agent/query': {
    data: AgentQueryEvent['data'];
  };
  'investigation/start': {
    data: CodeInvestigationEvent['data'];
  };
  'investigation/search': {
    data: CodeSearchEvent['data'];
  };
  'investigation/execute': {
    data: ScriptExecutionEvent['data'];
  };
  'investigation/update': {
    data: InvestigationUpdateEvent['data'];
  };
  'security/analyze': {
    data: SecurityAnalyzeEvent['data'];
  };
};

// Create a client to send and receive events
export const inngest = new Inngest({
  id: 'vercel-sandbox-demo',
  // Use the validated environment variable
  eventKey: env.INNGEST_EVENT_KEY,
  schemas: new EventSchemas().fromRecord<Events>(),
});
