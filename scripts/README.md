# Lightfast Scripts

Utility scripts for testing and development.

## test-notification.ts

Test script for the Knock notification flow. Triggers a test observation.captured event through Inngest to verify the complete notification pipeline.

### Prerequisites

- Dev server running (`pnpm dev:app`)
- Knock workflow committed in dashboard
- Environment variables configured (KNOCK_API_KEY, etc.)

### Usage

```bash
# Using default test IDs
pnpm test:notification

# With custom org and workspace IDs
pnpm test:notification org_2abc123 ws_xyz789
```

### What it does

1. Sends an `observation.captured` event to Inngest with significance score 85
2. Triggers the `notificationDispatch` function (threshold >= 70)
3. Calls Knock API to trigger `observation-captured` workflow
4. Knock delivers notification to in-app feed channel
5. Notification appears in bell icon (if user is logged into that org)

### Expected Output

```
🧪 Knock Notification Test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Org ID:       org_test_notification
  Workspace ID: workspace_test_notification
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Event sent to Inngest successfully!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Event IDs: 01KGTPJRT4DHEZPWPT2JNQ3QJB
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Verification

Check the logs for successful execution:

```bash
# Follow notification flow
tail -f /tmp/console-dev.log | grep -E "notificationDispatch|Knock"

# Output should show:
# - "Knock notification triggered" with observation details
# - "inngest/function.finished" event
```

### Troubleshooting

**Event sent but no notification:**
- Check if Knock workflow is committed in dashboard
- Verify KNOCK_API_KEY is set in environment
- Check Knock dashboard for workflow runs

**Connection refused:**
- Ensure dev server is running: `pnpm dev:app`
- Verify Inngest is healthy: `curl http://127.0.0.1:8288/health`

**Type errors when running:**
- Ensure inngest package is installed: `pnpm install`
- TypeScript compilation happens automatically via tsx
