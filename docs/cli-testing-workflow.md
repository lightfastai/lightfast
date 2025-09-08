# CLI Testing Workflow for API Key Authentication

Complete workflow for testing CLI commands with API keys, including automated web signup using Playwright.

## Setup

### Start Development Servers
```bash
pnpm dev:auth > /tmp/auth-dev.log 2>&1 &   # Port 4102
pnpm dev:cloud > /tmp/cloud-dev.log 2>&1 & # Port 4103

# Verify
curl http://localhost:4102/api/health
curl http://localhost:4103/api/health
```

### Build CLI
```bash
cd core/cli && pnpm build
```

## Automated API Key Creation with Playwright

### Step 1: User Signup Flow

```javascript
// Navigate to signup
await page.goto('http://localhost:4102/sign-up');

// Fill signup form with test credentials
await page.fill('[name="email"]', 'test+clerk_test@lightfast.ai');
await page.fill('[name="password"]', 'testpassword123');
await page.click('button[type="submit"]');

// Handle verification (development mode)
await page.fill('[name="code"]', '424242');  // Development verification code
await page.click('button[type="submit"]');
```

**Important Dev Credentials:**
- **Email Pattern**: `*+clerk_test@lightfast.ai` (Clerk development pattern)
- **Verification Code**: `424242` (not `123456`)
- **Password**: Any valid password

### Step 2: Organization Creation

```javascript
// Create organization after signup
await page.fill('[name="organizationName"]', 'test-org');
await page.click('button[type="submit"]');

// Verify redirect to cloud app
expect(page.url()).toContain('http://localhost:4103/orgs/test-org');
```

### Step 3: API Key Creation

```javascript
// Navigate to API keys (organization-scoped URL required)
await page.goto('http://localhost:4103/orgs/test-org/settings/api-keys');

// Create API key
await page.click('button:has-text("Create API Key")');
await page.fill('[name="name"]', 'test-cli-key');
await page.fill('[name="description"]', 'Testing CLI authentication');
await page.click('button:has-text("Create Key")');

// Copy the generated key (shown only once)
const apiKeyElement = await page.locator('[data-testid="api-key-value"]');
const apiKey = await apiKeyElement.textContent();
expect(apiKey).toMatch(/^lf_/); // Must start with lf_

// Key must be copied before continuing
await page.click('button:has-text("Copy")');
await page.click('button:has-text("Continue")');
```

**Critical URL Pattern:**
- ❌ Wrong: `/settings/api-keys` (returns 404)
- ✅ Correct: `/orgs/{slug}/settings/api-keys`

## Manual API Key Creation

If you prefer manual testing:

1. **Signup**: Navigate to http://localhost:4102/sign-up
   - Use email: `test+clerk_test@lightfast.ai`
   - Verification code: `424242`

2. **Create Organization**: After signup, create org (e.g., "test-org")

3. **Create API Key**: 
   - Go to: `http://localhost:4103/orgs/test-org/settings/api-keys`
   - Create new API key, copy it (starts with `lf_`)

## Test CLI Commands

Set local environment:
```bash
export LIGHTFAST_BASE_URL=http://localhost:4103
```

### Test Authentication
```bash
# Login with API key
node dist/index.js auth login --api-key lf_your_key_here

# Check status
node dist/index.js auth status

# Get user info
node dist/index.js auth whoami
```

### Expected Outputs

**Whoami (authenticated):**
```
→ Lightfast User Information
✔ Successfully Authenticated

👤 User Information:
  User ID: user_xxx
  Key ID: key_xxx

🔑 Authentication Details:
  Profile: default
  API Key: lf_xxx****xxx
  Endpoint: http://localhost:4103
```

**Status (authenticated):**
```
→ Lightfast Authentication Status
✔ Authenticated
  Profile: default
  User ID: user_xxx
  API Endpoint: http://localhost:4103
```

## Advanced Testing

### Profile Management
```bash
# Test multiple profiles
node dist/index.js auth login --profile work --api-key lf_work_key
node dist/index.js auth login --profile personal --api-key lf_personal_key

# Switch between profiles
node dist/index.js auth whoami --profile work
node dist/index.js auth whoami --profile personal
```

### Error Handling Tests
```bash
# Test invalid API key
node dist/index.js auth login --api-key invalid_key

# Test network connectivity (stop cloud app first)
pkill -f "pnpm.*cloud"
node dist/index.js auth whoami  # Should show network error
```

## Troubleshooting

### Common Issues
- **"Email address is taken"**: Use different email with `+clerk_test` pattern or existing test account
- **404 on API keys page**: Must use `/orgs/{slug}/settings/api-keys`, not `/settings/api-keys`
- **Verification code rejected**: Use `424242` for development, not `123456`
- **CLI network errors**: Set `LIGHTFAST_BASE_URL=http://localhost:4103`
- **Invalid API key format**: Ensure key starts with `lf_` and is copied exactly

### Development Server Management
```bash
# Monitor logs
tail -f /tmp/auth-dev.log
tail -f /tmp/cloud-dev.log

# Stop servers
pkill -f "pnpm.*dev"

# Check for errors
grep -i error /tmp/auth-dev.log
```

## API Structure

CLI now uses dedicated endpoints:
- **Route**: `/api/cli/v1/[trpc]`
- **Package**: `@api/cli`  
- **Endpoints**: `apiKey.validate`, `apiKey.whoami`

The CLI automatically points to the correct API structure via `@lightfastai/cloud-client`.