import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest/client';
import { functions } from '@/lib/inngest/functions';

// Create an API route handler for Inngest
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: functions,
});
