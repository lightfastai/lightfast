# @vendor/upstash-workflow

Vendor abstraction for [Upstash Workflow](https://upstash.com/docs/workflow) - durable, reliable serverless workflow orchestration.

## Usage

### Triggering a Workflow

```typescript
import { workflowClient } from "@vendor/upstash-workflow/client";

await workflowClient.trigger({
  url: "https://example.com/api/workflow",
  body: JSON.stringify({ userId: "user_123" }),
  headers: { "Content-Type": "application/json" },
});
```

### Creating a Workflow (Next.js)

```typescript
import { serve } from "@vendor/upstash-workflow/nextjs";

export const { POST } = serve<{ userId: string }>(async (context) => {
  const { userId } = context.requestPayload;

  const result = await context.run("process-data", async () => {
    return processUserData(userId);
  });

  await context.run("send-notification", async () => {
    return sendEmail(result.email);
  });
});
```

### Creating a Workflow (Hono)

```typescript
import { serve } from "@vendor/upstash-workflow/hono";

export const myWorkflow = serve<MyPayload>(async (context) => {
  // ...steps
});
```

## Exports

| Entrypoint | Export |
|---|---|
| `@vendor/upstash-workflow` | `workflowClient`, `serve` (Next.js), `Client` type, `WorkflowContext` type |
| `@vendor/upstash-workflow/client` | `workflowClient` singleton |
| `@vendor/upstash-workflow/nextjs` | `serve` (Next.js adapter) |
| `@vendor/upstash-workflow/hono` | `serve` (Hono adapter) |

## Environment Variables

```bash
QSTASH_TOKEN=your-qstash-token
```

## Learn More

- [Upstash Workflow Docs](https://upstash.com/docs/workflow)
- [Workflow SDK on GitHub](https://github.com/upstash/workflow-js)
