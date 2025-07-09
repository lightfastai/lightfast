import { EventSchemas, Inngest } from 'inngest';
import { env } from '@/env';
import type { UpdateEvent, TaskExecuteEvent } from '@/types/inngest';

// Define type for the events
type Events = {
  'updates/send': {
    data: UpdateEvent['data'];
  };
  'task/execute': {
    data: TaskExecuteEvent['data'];
  };
};

// Create a client to send and receive events
export const inngest = new Inngest({
  id: 'vercel-sandbox-demo',
  // Use the validated environment variable
  eventKey: env.INNGEST_EVENT_KEY,
  schemas: new EventSchemas().fromRecord<Events>(),
});
