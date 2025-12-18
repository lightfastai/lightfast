# Vercel Integration Setup Guide

This guide documents how to create a Vercel integration for Lightfast to capture deployment events and infrastructure state.

## Prerequisites

- Access to Vercel team account (https://vercel.com/lightfast)
- Lightfast logo (512x512 PNG recommended)
- Featured image (minimum 1920x1080, 16:9 aspect ratio)
- ngrok or public URL for webhooks (development)

## Integration Creation Steps

### 1. Navigate to Integrations Console

Go to: https://vercel.com/lightfast/~/integrations/console

Click the "Create" button to start a new integration.

### 2. Profile Information

#### Basic Details
- **Name**: `Lightfast Dev` (or `Lightfast` for production)
- **Category**: `DevTools`
- **URL Slug**: `lightfast-dev` (permanent, cannot be changed)
- **Developer**: `Lightfast`

#### Short Description (max 128 chars)
```
Memory layer for software teams - captures deployments & infrastructure state.
```

#### Logo
- Upload a square logo (recommended 512x512 PNG)
- Location: `apps/www/public/android-chrome-512x512.png`
- Required field

#### Contact Information
- **Contact Email**: `support@lightfast.ai` (private)
- **Support Email**: `support@lightfast.ai` (public)
- ☑ Check "Use the same contact information for support inquiries"

#### Extended Description (max 240 chars)
```
Lightfast captures deployment events and infrastructure state to build searchable memory for your engineering team. Development integration for testing and local development.
```

### 3. URLs

- **Website**: `https://lightfast.ai`
- **Documentation URL**: `https://lightfast.ai/docs/connectors/vercel`
- **EULA URL**: `https://lightfast.ai/legal/terms`
- **Privacy Policy URL**: `https://lightfast.ai/legal/privacy`
- **Support URL**: `https://help.lightfast.ai`

### 4. Overview & Instructions

#### Overview (required, max 768 chars, Markdown supported)
```markdown
## Lightfast Dev Integration

Lightfast captures deployment events and infrastructure state from Vercel to build searchable memory for your engineering team.

This development integration enables testing and local development workflows.
```

#### Additional Information (optional, max 1024 chars, Markdown supported)
Leave empty for initial setup.

### 5. Featured Images

Upload 1-8 images for the integration details page:
- **Aspect Ratio**: 16:9
- **Minimum Size**: 1920x1080 pixels
- **Format**: PNG or JPG
- **Required**: At least 1 image

### 6. Settings

#### Redirect URL
```
https://your-ngrok-url.ngrok.io/integrations/vercel/callback
```

For production:
```
https://lightfast.ai/integrations/vercel/callback
```

#### API Scopes

Select the following scopes:
- **Integration Configuration**: `Read` (default, required)
- **Integration Resource**: `None`
- **Deployments**: `None` (we only need webhook events)
- **Deployment Checks**: `None`
- **Projects**: `None`
- **Project Environment Variables**: `None`
- **Global Project Environment Variables**: `None`
- **Project Protection Bypass**: `None`
- **Teams**: `None`
- **Current User**: `None`
- **Domains**: `None`
- **Edge Config**: `None`

#### Webhook Configuration

**Webhook URL**:
```
https://your-ngrok-url.ngrok.io/api/webhooks/vercel
```

For production:
```
https://lightfast.ai/api/webhooks/vercel
```

**Selected Webhook Events**:
- ☑ `deployment.created`
- ☑ `deployment.succeeded`
- ☑ `deployment.error`
- ☑ `deployment.canceled`

**Automatically Subscribed** (cannot be disabled):
- `marketplace.invoice.created`
- `marketplace.invoice.paid`
- `marketplace.invoice.notpaid`
- `marketplace.invoice.refunded`
- `deployment.integration.action.start`
- `deployment.integration.action.cancel`
- `deployment.integration.action.cleanup`
- `integration-configuration.removed`

#### Configuration URL
Leave empty unless you need a post-install configuration page.

### 7. Terms of Service

☑ Check "I accept" for Vercel's Integrations Marketplace Agreement

### 8. Create Integration

Click the **Create** button at the bottom of the page.

## Post-Creation Steps

After creating the integration, you'll receive:
1. **Client Secret ID** - Used to identify your integration
2. **Client Integration Secret** - For OAuth flow (keep secure)

### Update Environment Variables

Add these to your `.env` file:

```bash
VERCEL_CLIENT_SECRET_ID="your-client-secret-id"
VERCEL_CLIENT_INTEGRATION_SECRET="your-client-integration-secret"
# Note: Webhook verification uses the CLIENT_INTEGRATION_SECRET (no separate webhook secret)
```

## Implementation Architecture

### Directory Structure

Follow the standardized integration pattern:

```
apps/console/
├── src/
│   └── app/
│       └── (vercel)/
│           └── api/
│               └── vercel/
│                   ├── callback/
│                   │   └── route.ts       # OAuth callback
│                   └── webhooks/
│                       └── route.ts       # Webhook handler
packages/
└── console-webhooks/
    └── src/
        └── vercel.ts                      # Webhook verification
```

### Webhook Handler Pattern

See `apps/console/src/app/(github)/api/github/webhooks/route.ts` for reference implementation.

Key requirements:
1. Export `runtime = "nodejs"` for webhook handlers
2. Read raw request body with `request.text()` before parsing
3. Verify webhook signature using HMAC-SHA1
4. Return structured response with `{ verified: boolean, event?: T, error?: string }`

### Middleware Configuration

Add Vercel webhook route to public routes in `apps/console/src/middleware.ts`:

```typescript
const publicRoutes = createRouteMatcher([
  "/api/github(.*)",
  "/api/vercel(.*)",  // Add this
  // ... other routes
]);
```

## Webhook Verification

Vercel uses HMAC-SHA1 for webhook signatures (via `x-vercel-signature` header).

See `packages/console-webhooks/src/github.ts` for reference implementation pattern.

## Testing

### Local Development with ngrok

1. Start ngrok tunnel:
   ```bash
   ngrok http 4107
   ```

2. Update integration URLs in Vercel console:
   - Redirect URL: `https://your-ngrok-url.ngrok.io/integrations/vercel/callback`
   - Webhook URL: `https://your-ngrok-url.ngrok.io/api/webhooks/vercel`

3. Test webhook delivery:
   ```bash
   # Trigger a deployment
   vercel deploy

   # Check webhook logs in console
   tail -f /tmp/console-dev.log
   ```

## Webhook Event Payloads

### deployment.created
```json
{
  "type": "deployment.created",
  "createdAt": 1234567890,
  "payload": {
    "deployment": {
      "id": "dpl_xxx",
      "name": "my-project",
      "url": "my-project-xxx.vercel.app",
      "meta": { "githubCommitSha": "abc123" }
    },
    "project": { "id": "prj_xxx", "name": "my-project" },
    "team": { "id": "team_xxx", "name": "lightfast" }
  }
}
```

### deployment.succeeded
```json
{
  "type": "deployment.succeeded",
  "createdAt": 1234567890,
  "payload": {
    "deployment": {
      "id": "dpl_xxx",
      "readyState": "READY",
      "url": "my-project-xxx.vercel.app"
    }
  }
}
```

### deployment.error
```json
{
  "type": "deployment.error",
  "createdAt": 1234567890,
  "payload": {
    "deployment": {
      "id": "dpl_xxx",
      "readyState": "ERROR",
      "errorCode": "BUILD_FAILED"
    }
  }
}
```

## References

- [Vercel Integrations Documentation](https://vercel.com/docs/integrations)
- [Vercel Webhook Events](https://vercel.com/docs/integrations#webhooks)
- [Vercel API Scopes](https://vercel.com/docs/rest-api/vercel-api-integrations#scopes)
- GitHub Integration Implementation: `apps/console/src/app/(github)/api/github/`
- Phase 01 Plan: `docs/architecture/plans/neural-memory/phase-01-foundation.md`

## Troubleshooting

### "Invalid values provided for featuredImages"
- Ensure at least one image is uploaded
- Verify image dimensions are minimum 1920x1080
- Check aspect ratio is exactly 16:9

### "Must provide a EULA URL"
- EULA URL is required (use `https://lightfast.ai/legal/terms`)
- Cannot be empty

### "An overview description is required"
- Overview field must have markdown content
- Use the template provided above

### Webhook not receiving events
1. Check ngrok tunnel is running
2. Verify webhook URL in integration settings
3. Check webhook secret in environment variables
4. Review middleware configuration for public routes
