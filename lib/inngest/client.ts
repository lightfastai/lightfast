import { Inngest } from 'inngest';

// Create a client to send and receive events
export const inngest = new Inngest({
  id: 'vercel-sandbox-demo',
  // Use the INNGEST_EVENT_KEY environment variable for production
  eventKey: process.env.INNGEST_EVENT_KEY,
});
