---
description: Manage the Lightfast Dev Vercel integration settings via Playwright
---

# Vercel Integration Manager

You are tasked with managing the existing Lightfast Dev Vercel integration through automated browser interaction using Playwright.

**Integration URL**: `https://vercel.com/lightfast/~/integrations/console/lightfast-dev`

## What This Command Does

- Update redirect and webhook URLs (e.g., when ngrok URL changes)
- Update webhook event subscriptions
- View integration credentials
- Update other integration settings

## Initial Response

When this command is invoked, respond with:

```
I'll help you manage the Lightfast Dev Vercel integration.

What would you like to do?

1. **Update URLs** - Change redirect/webhook URLs (e.g., new ngrok domain)
2. **Update webhook events** - Add/remove webhook event subscriptions
3. **View credentials** - Display Client ID and Secret
4. **Update settings** - Modify other integration settings

Please specify the action and any relevant details.
```

Then wait for the user's input.

## Prerequisites

Before starting any operation:

1. **Check Playwright browser availability**:
   - Verify browser is running with a snapshot check
   - If not available, inform user to start browser first

2. **Navigate to integration page**:
   - Go to `https://vercel.com/lightfast/~/integrations/console/lightfast-dev`
   - Verify login status
   - If not logged in, pause and ask user to log in

## Process: Update URLs

This is the most common operation when ngrok URLs change.

### Step 1: Get New URLs

Ask the user:
```
I'll update the integration URLs.

Please provide:
1. **New redirect URL** (e.g., "https://your-ngrok-url.ngrok.io/integrations/vercel/callback")
2. **New webhook URL** (e.g., "https://your-ngrok-url.ngrok.io/api/webhooks/vercel")

Or just provide the ngrok domain and I'll construct the full URLs.
```

### Step 2: Navigate and Update

1. Navigate to `https://vercel.com/lightfast/~/integrations/console/lightfast-dev`
2. Click "Redirect URL" link in sidebar navigation
3. Fill redirect URL field:
   ```typescript
   await page.getByRole('textbox', { name: 'https://my-app.com/integrations/vercel/callback' })
     .fill('https://new-ngrok-url.ngrok.io/integrations/vercel/callback')
   ```
4. Click "Webhook" link in sidebar navigation
5. Fill webhook URL field:
   ```typescript
   await page.getByRole('textbox', { name: 'https://my-app.com/api/webhook' })
     .fill('https://new-ngrok-url.ngrok.io/api/webhooks/vercel')
   ```
6. Click "Update" button at bottom of page
7. Verify success toast: "Your integration was updated successfully!"

### Step 3: Confirm

Report to user:
```
✅ URLs updated successfully!

- Redirect URL: https://new-ngrok-url.ngrok.io/integrations/vercel/callback
- Webhook URL: https://new-ngrok-url.ngrok.io/api/webhooks/vercel

The integration is now configured for your current ngrok tunnel.
```

## Process: Update Webhook Events

### Step 1: Get Event List

Ask the user:
```
Current webhook events:
- deployment.created ✓
- deployment.succeeded ✓
- deployment.error ✓
- deployment.canceled ✓

Would you like to:
1. Add events (specify which ones)
2. Remove events (specify which ones)
```

### Step 2: Navigate and Update

1. Navigate to `https://vercel.com/lightfast/~/integrations/console/lightfast-dev`
2. Click "Webhook" link in sidebar
3. Locate the event checkboxes
4. Toggle events using force click (elements may overlap):
   ```typescript
   await page.getByRole('checkbox', { name: 'Deployment Created deployment.created' })
     .click({ force: true })
   ```
5. Click "Update" button
6. Verify success toast

## Process: View Credentials

### Step 1: Navigate to Credentials

1. Navigate to `https://vercel.com/lightfast/~/integrations/console/lightfast-dev`
2. Click "Credentials" link in sidebar navigation
3. Take snapshot to capture the credentials section

### Step 2: Display Credentials

Report to user:
```
Vercel Integration Credentials:

**Client (Integration) ID**: oac_uIBBCpgLgLoig0qd82gxo0yO

**Client (Integration) Secret**: *****************
(Copy manually from the Vercel console - click the copy button)

**Environment Variables**:
Add these to your `.env.development.local`:

```bash
VERCEL_CLIENT_SECRET_ID="oac_uIBBCpgLgLoig0qd82gxo0yO"
VERCEL_CLIENT_INTEGRATION_SECRET="<copy from Vercel console>"
# Note: Webhook verification uses the CLIENT_INTEGRATION_SECRET
```
```

## Important Patterns & Learnings

### URL Update Pattern

Always use sidebar navigation to jump to sections:
```typescript
// Navigate to redirect URL section
await page.getByRole('link', { name: 'Redirect URL' }).click()

// Navigate to webhook section
await page.getByRole('link', { name: 'Webhook', exact: true }).click()
```

### Form Filling with run_code

For reliable form filling, use the `browser_run_code` tool:
```typescript
await page.getByRole('textbox', { name: '...' })
  .fill('https://new-url.com')
```

### Checkbox Interaction

Webhook event checkboxes may have overlapping elements. Always use force click:
```typescript
await page.getByRole('checkbox', { name: 'Event Name event.type' })
  .click({ force: true })
```

### Success Verification

After any update, verify with:
1. Check for success toast message
2. Take snapshot to confirm changes persisted
3. Optionally refresh page to double-check

## Common Use Cases

### Use Case 1: New ngrok Session

When ngrok restarts with a new URL:

```
User: "Update URLs for new ngrok: molecularly-nonevincible-erlene.ngrok-free.dev"