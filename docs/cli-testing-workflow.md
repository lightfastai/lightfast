# CLI Testing Workflow for API Key Authentication

Quick workflow for testing CLI commands with API keys in development.

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

## Get API Key

1. **Signup**: Navigate to http://localhost:4102/sign-up
   - Use email pattern: `test+clerk_test@lightfast.ai`
   - Verification code: `424242` (dev mode)

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

## Troubleshooting

- **404 on API keys page**: Use `/orgs/{slug}/settings/api-keys`, not `/settings/api-keys`
- **Invalid verification**: Use `424242` for development, not `123456`
- **CLI network errors**: Set `LIGHTFAST_BASE_URL=http://localhost:4103`
- **Invalid API key**: Ensure key starts with `lf_` and is copied exactly

## API Structure

CLI now uses dedicated endpoints:
- **Route**: `/api/cli/v1/[trpc]`
- **Package**: `@api/cli`  
- **Endpoints**: `apiKey.validate`, `apiKey.whoami`

The CLI automatically points to the correct API structure via `@lightfastai/cloud-client`.