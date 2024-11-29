import { inngest } from "@repo/events/client";

// create a database for a user
export const okFunction = inngest.createFunction(
  { id: "ok" },
  { event: "ok" },
  async ({ event, step }) => {
    return {
      message: "OK",
    };
  },
);
