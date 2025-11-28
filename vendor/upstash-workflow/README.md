# @vendor/upstash-workflow

Vendor abstraction for [Upstash Workflow](https://upstash.com/docs/workflow) - durable, reliable serverless workflow orchestration.

## Features

- **Durable Execution**: Steps automatically recover from errors and infrastructure failures
- **Automatic Retries**: Built-in retry logic with exponential backoff
- **Type-Safe**: Full TypeScript support with type inference
- **Next.js Integration**: First-class support for Next.js API routes
- **Standalone**: Independent vendor package with no cross-dependencies

## Installation

This package is part of the Lightfast monorepo and uses workspace dependencies:

```json
{
  "dependencies": {
    "@vendor/upstash-workflow": "workspace:*"
  }
}
```

## Environment Variables

Add these to your `.env` file:

```bash
# Required: QStash token from https://console.upstash.com/qstash
QSTASH_TOKEN=your-qstash-token

# Optional: Override QStash API endpoint
QSTASH_URL=https://qstash.upstash.io
```

## Usage

### Creating a Workflow Endpoint

```typescript
// app/api/workflow/route.ts
import { serve } from "@vendor/upstash-workflow/nextjs";

interface MyPayload {
  userId: string;
  action: string;
}

export const { POST } = serve<MyPayload>(async (context) => {
  const payload = context.requestPayload;

  // Step 1: Process data
  const result1 = await context.run("process-data", async () => {
    return processUserData(payload.userId);
  });

  // Step 2: Send notification
  await context.run("send-notification", async () => {
    return sendEmail(result1.email);
  });

  // Step 3: Wait before cleanup
  await context.sleep(60); // 60 seconds

  // Step 4: Cleanup
  await context.run("cleanup", async () => {
    return cleanupResources(payload.userId);
  });
});
```

### Triggering a Workflow

```typescript
// Trigger from another API route or function
import { WorkflowClient } from "@vendor/upstash-workflow";

const client = new WorkflowClient();

const result = await client.trigger({
  url: "https://example.com/api/workflow",
  body: {
    userId: "user_123",
    action: "signup"
  }
});

console.log("Workflow started:", result.workflowRunId);
```

### Using the Singleton Client

```typescript
import { getWorkflowClient } from "@vendor/upstash-workflow";

// Get or create the default client instance
const client = getWorkflowClient();

await client.trigger({
  url: "https://example.com/api/workflow",
  body: { foo: "bar" }
});
```

### Advanced Workflow Features

```typescript
import { serve, workflowUtils } from "@vendor/upstash-workflow/nextjs";

export const { POST } = serve(async (context) => {
  // Sleep for duration
  await workflowUtils.sleep(context, 30); // 30 seconds

  // Sleep until timestamp
  await workflowUtils.sleepUntil(context, Date.now() + 60000);

  // Wait for external event
  const eventData = await workflowUtils.waitForEvent(
    context,
    "payment-completed",
    3600 // timeout in seconds
  );

  // Notify an event
  await workflowUtils.notify(context, "processing-complete", { success: true });

  // Make external HTTP call
  const apiResponse = await workflowUtils.call(
    context,
    "fetch-user-data",
    "https://api.example.com/user/123"
  );
});
```

## API Reference

### `WorkflowClient`

Client for triggering workflows from anywhere in your application.

**Methods:**
- `trigger(options)` - Start a new workflow execution
- `cancel(workflowRunId)` - Cancel a running workflow

### `serve(handler, options?)`

Create a Next.js API route handler for a workflow.

**Parameters:**
- `handler` - Workflow handler function
- `options.receiver` - Optional receiver URL for webhooks
- `options.verbose` - Enable verbose logging

### `workflowUtils`

Utility functions for workflow operations:
- `sleep(context, seconds)` - Pause execution
- `sleepUntil(context, timestamp)` - Pause until timestamp
- `waitForEvent(context, eventId, timeout)` - Wait for event
- `notify(context, eventId, data)` - Trigger event
- `call(context, stepId, url, options)` - External HTTP call

## Examples

### Webhook Processing

```typescript
// app/api/github/webhooks/workflow/route.ts
import { serve } from "@vendor/upstash-workflow/nextjs";

export const { POST } = serve(async (context) => {
  const webhook = context.requestPayload;

  // Step 1: Verify signature
  await context.run("verify", async () => {
    return verifyWebhookSignature(webhook);
  });

  // Step 2: Process event
  await context.run("process", async () => {
    return processGitHubEvent(webhook);
  });

  // Step 3: Send notification
  await context.run("notify", async () => {
    return notifyTeam(webhook);
  });
});
```

### Scheduled Workflow

```typescript
import { WorkflowClient } from "@vendor/upstash-workflow";

const client = new WorkflowClient();

// Trigger with delay
await client.trigger({
  url: "https://example.com/api/cleanup",
  body: { userId: "123" },
  delay: 3600 // Start in 1 hour
});
```

## Architecture

This vendor package:
- ✅ **Standalone**: No dependencies on other vendor packages
- ✅ **Type-safe**: Full TypeScript coverage
- ✅ **Minimal**: Thin wrapper around @upstash/workflow
- ✅ **Testable**: Easy to mock and test

## Related Packages

- `@vendor/upstash` - Upstash Redis and KV abstractions
- `@vendor/inngest` - Alternative workflow orchestration

## Learn More

- [Upstash Workflow Docs](https://upstash.com/docs/workflow)
- [QStash Console](https://console.upstash.com/qstash)
- [Workflow SDK on GitHub](https://github.com/upstash/workflow-js)
