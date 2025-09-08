# End-to-End Testing Workflow for CLI API Key Authentication

This document provides a comprehensive workflow for testing CLI API key authentication in development environments using Playwright browser automation.

## Overview

Test the complete flow: **Auth App Signup → Organization Creation → Cloud App API Key Creation → CLI Authentication**

### Test Stack
- **Browser Automation**: Playwright
- **Auth App**: http://localhost:4102 (signup, org creation)
- **Cloud App**: http://localhost:4103 (API key management)
- **CLI**: Built from `core/cli-core` (authentication commands)

## Prerequisites

### Environment Setup
```bash
# Start development servers in background
pnpm dev:auth > /tmp/auth-dev.log 2>&1 &
pnpm dev:cloud > /tmp/cloud-dev.log 2>&1 &

# Verify servers are healthy
curl http://localhost:4102/api/health
curl http://localhost:4103/api/health

# Monitor logs
tail -f /tmp/auth-dev.log
tail -f /tmp/cloud-dev.log
```

### Build CLI
```bash
cd core/cli && pnpm build
```

## Step 1: Web-Based User Signup Flow

### 1.1 Navigate to Auth App Signup
```javascript
await page.goto('http://localhost:4102/sign-up');
```

### 1.2 Handle Development Test Credentials

**Important**: Use Clerk development test pattern:
- **Email Pattern**: `*+clerk_test@lightfast.ai` 
- **Verification Code**: `424242` (development only)
- **Password**: Any valid password

Example:
```javascript
await page.fill('[name="email"]', 'test+clerk_test@lightfast.ai');
await page.fill('[name="password"]', 'testpassword123');
await page.click('button[type="submit"]');

// Handle verification
await page.fill('[name="code"]', '424242');
await page.click('button[type="submit"]');
```

### 1.3 Organization Creation
After signup verification, create an organization:
```javascript
await page.fill('[name="organizationName"]', 'test-org');
await page.click('button[type="submit"]');
```

### 1.4 Verify Redirect to Cloud App
Expected redirect: `http://localhost:4103/orgs/test-org/dashboard`

## Step 2: API Key Creation in Cloud App

### 2.1 Navigate to API Keys Settings

**Critical**: Use organization-scoped URL pattern:
```javascript
await page.goto('http://localhost:4103/orgs/test-org/settings/api-keys');
```

**❌ Wrong**: `/settings/api-keys` (returns 404)  
**✅ Correct**: `/orgs/{slug}/settings/api-keys`

### 2.2 API Key Creation Flow

The cloud app implements a 2-step security process:

```javascript
// Step 1: Click "Create API Key"
await page.click('button:has-text("Create API Key")');

// Fill form
await page.fill('[name="name"]', 'test-cli-key');
await page.fill('[name="description"]', 'Testing CLI authentication');
await page.click('button:has-text("Create Key")');

// Step 2: Copy the generated key (shown only once)
const apiKeyElement = await page.locator('[data-testid="api-key-value"]');
const apiKey = await apiKeyElement.textContent();

// Key must be copied before continuing
await page.click('button:has-text("Copy")');
await page.click('button:has-text("Continue")');
```

### 2.3 API Key Format Validation

Generated keys must follow the pattern:
- **Prefix**: `lf_`
- **Format**: `lf_[random_string]`
- **Length**: Variable (typically 40+ characters)

## Step 3: CLI Authentication Testing

### 3.1 Environment Configuration

For local development testing:
```bash
export LIGHTFAST_BASE_URL=http://localhost:4103
```

### 3.2 CLI Command Testing

#### Test 1: Authentication Status (Before Login)
```bash
node dist/index.js auth status
```

Expected output:
```
→ Lightfast Authentication Status
📋 Checking Default Profile
❌ Not Authenticated
  Profile: default
  Status: No credentials found
  API Endpoint: http://localhost:4103
```

#### Test 2: Manual API Key Login
```bash
node dist/index.js auth login --api-key lf_your_generated_key_here
```

#### Test 3: Whoami Command (After Authentication)
```bash
node dist/index.js auth whoami
```

Expected output:
```
→ Lightfast User Information
  Profile: default

✔ Successfully Authenticated

👤 User Information:
  User ID: user_xxx
  Key ID: key_xxx

🔑 Authentication Details:
  Profile: default
  API Key: lf_xxx****xxx
  Endpoint: http://localhost:4103
  Last Login: [timestamp]
```

### 3.3 API Integration Testing

The CLI uses TRPC client with new endpoint structure:

```bash
# API endpoint structure (as of migration)
# Old: /api/cloud
# New: /api/cli/v1

# Endpoints available:
# - apiKey.validate: Validates API keys
# - apiKey.whoami: Returns user information
```

## Step 4: Advanced Testing Scenarios

### 4.1 Profile Management
```bash
# Test multiple profiles
node dist/index.js auth login --profile work --api-key lf_work_key
node dist/index.js auth login --profile personal --api-key lf_personal_key

# Switch between profiles
node dist/index.js auth whoami --profile work
node dist/index.js auth whoami --profile personal
```

### 4.2 Error Handling Tests

#### Invalid API Key
```bash
node dist/index.js auth login --api-key invalid_key
# Should show proper error message
```

#### Network Connectivity
```bash
# Stop cloud app and test
pkill -f "pnpm.*cloud"
node dist/index.js auth whoami
# Should show network error
```

#### Key Validation
```bash
# Test with wrong prefix
node dist/index.js auth login --api-key wrong_prefix_key
# Should show validation error
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. "Email address is taken"
- Use different email with `+clerk_test` pattern
- Or use existing test account credentials

#### 2. "404 on API keys page"
- Check URL pattern: must include `/orgs/{slug}/`
- Verify organization creation was successful

#### 3. "Verification code rejected"
- Use development code: `424242`
- Not `123456` (production pattern)

#### 4. "CLI commands fail with network errors"
- Verify `LIGHTFAST_BASE_URL=http://localhost:4103`
- Check development servers are running
- Rebuild CLI after API changes

#### 5. "Invalid API key format"
- Ensure key starts with `lf_`
- Copy key exactly from web interface
- No extra whitespace or characters

### Development Server Management

#### Start Servers
```bash
pnpm dev:auth > /tmp/auth-dev.log 2>&1 &
pnpm dev:cloud > /tmp/cloud-dev.log 2>&1 &
```

#### Monitor Logs
```bash
# Real-time monitoring
tail -f /tmp/auth-dev.log
tail -f /tmp/cloud-dev.log

# Check for errors
grep -i error /tmp/auth-dev.log
grep -i error /tmp/cloud-dev.log
```

#### Stop Servers
```bash
pkill -f "pnpm.*dev"
# Or individual apps:
pkill -f "pnpm.*auth"
pkill -f "pnpm.*cloud"
```

## Automated Testing Integration

### Playwright Test Example
```javascript
// tests/e2e/cli-auth.spec.ts
import { test, expect } from '@playwright/test';

test('CLI API key authentication flow', async ({ page }) => {
  // Step 1: Web signup
  await page.goto('http://localhost:4102/sign-up');
  await page.fill('[name="email"]', `test${Date.now()}+clerk_test@lightfast.ai`);
  await page.fill('[name="password"]', 'testpassword123');
  await page.click('button[type="submit"]');
  
  // Verification
  await page.fill('[name="code"]', '424242');
  await page.click('button[type="submit"]');
  
  // Organization creation
  await page.fill('[name="organizationName"]', 'test-org');
  await page.click('button[type="submit"]');
  
  // Step 2: API key creation
  await page.goto('http://localhost:4103/orgs/test-org/settings/api-keys');
  await page.click('button:has-text("Create API Key")');
  await page.fill('[name="name"]', 'e2e-test-key');
  await page.click('button:has-text("Create Key")');
  
  const apiKey = await page.locator('[data-testid="api-key-value"]').textContent();
  expect(apiKey).toMatch(/^lf_/);
  
  // Step 3: CLI testing (would use exec to run CLI commands)
  // This would require additional setup for subprocess testing
});
```

### CLI Test Helpers
```bash
#!/bin/bash
# scripts/test-cli-auth.sh

set -e

API_KEY="$1"
if [ -z "$API_KEY" ]; then
  echo "Usage: $0 <api_key>"
  exit 1
fi

export LIGHTFAST_BASE_URL=http://localhost:4103

# Build CLI
cd core/cli && pnpm build

# Test authentication
echo "Testing CLI authentication..."
node dist/index.js auth login --api-key "$API_KEY"

# Test whoami
echo "Testing whoami command..."
node dist/index.js auth whoami

# Test status
echo "Testing status command..."
node dist/index.js auth status

echo "✅ All CLI auth tests passed!"
```

## API Architecture Notes

### Current Endpoint Structure (Post-Migration)
- **CLI API**: `/api/cli/v1/[trpc]`
- **Router**: `cliRouter` from `@api/cli` package
- **Endpoints**:
  - `apiKey.validate` - Key validation
  - `apiKey.whoami` - User information retrieval

### TRPC Integration
The CLI uses `@lightfastai/cloud-client` which creates a TRPC proxy client:
```typescript
createTRPCProxyClient<CliRouter>({
  links: [
    httpBatchLink({
      url: `${baseUrl}/api/cli/v1`,
      // ...
    }),
  ],
});
```

### Authentication Flow
1. User creates API key in web interface
2. CLI stores key in local profile (encrypted)
3. CLI sends key to `/api/cli/v1/apiKey.validate`
4. API validates key against database
5. Returns user/organization information

## Success Criteria

A complete E2E test should verify:

- ✅ User can sign up in auth app
- ✅ Organization is created successfully  
- ✅ User is redirected to cloud app
- ✅ API key can be created in cloud app
- ✅ API key follows correct format (`lf_` prefix)
- ✅ CLI accepts the API key for authentication
- ✅ CLI `whoami` returns correct user information
- ✅ CLI `status` shows authenticated state
- ✅ API key is linked to correct organization
- ✅ Error handling works for invalid keys

This workflow ensures the complete integration between web-based user management and CLI authentication systems.