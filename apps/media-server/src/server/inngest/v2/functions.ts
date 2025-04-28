import { inngest } from "./client";

// Define an event
export const helloWorldEvent = {
  name: "app/hello.world",
  data: {} as { message: string },
};

// Create a simple function that responds to the event
export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "app/hello.world" },
  async ({ event, step }) => {
    await step.sleep("wait-a-moment", "1s");
    return {
      message: `Hello, ${event.data.message}!`,
      timestamp: new Date().toISOString(),
    };
  },
);
