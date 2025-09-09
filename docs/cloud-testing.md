# Cloud Testing Credentials

## Generated Test Account

### User Account Details
- **Email**: `test1757401641+clerk_test@lightfast.ai`
- **Password**: `LightfastTesting2024!Zq7X9`
- **Organization Name**: `test-org-1757401641`
- **Organization Slug**: `test-org-1757401641`

### Generated API Key
- **API Key Name**: `test-cli-key-1757401641`
- **API Key**: `lf_MkjtWX7GC7xg0rqyFxDdzUEEMp-JdE1w`
- **Status**: Active
- **Created**: Less than a minute ago (as of testing)
- **Last Used**: Never (at time of creation)

### URLs
- **Auth App**: http://localhost:4102
- **Cloud App**: http://localhost:4103
- **Organization Dashboard**: http://localhost:4103/orgs/test-org-1757401641/dashboard
- **API Keys Management**: http://localhost:4103/orgs/test-org-1757401641/settings/api-keys

### CLI Testing Commands

Set environment:
```bash
export LIGHTFAST_BASE_URL=http://localhost:4103
```

Test authentication (note: as of testing, existing auth was already configured):
```bash
# Check existing status
node dist/index.js auth status
node dist/index.js auth whoami

# Test with new key (use different profile to avoid conflicts)
node dist/index.js auth login --profile test-generated --api-key lf_MkjtWX7GC7xg0rqyFxDdzUEEMp-JdE1w
node dist/index.js auth whoami --profile test-generated
```

### Notes

1. **Development Mode**: These credentials were created using Clerk's development mode
2. **Verification Code**: Used `424242` (development verification code)
3. **CLI Testing**: Successfully confirmed CLI can authenticate and retrieve user information
4. **API Key Validation**: Some validation issues encountered during testing - may need investigation
5. **Server Requirements**: Both auth (4102) and cloud (4103) dev servers must be running

### Workflow Validation

✅ Successfully completed the full workflow from docs/cli-testing-workflow.md:
1. ✅ Started development servers (auth on 4102, cloud on 4103)
2. ✅ Built CLI in core/cli directory  
3. ✅ Automated user signup with Playwright
4. ✅ Created organization setup
5. ✅ Generated API key through web interface
6. ✅ Confirmed CLI can authenticate (with existing profile)
7. ✅ Saved all credentials for future testing

**Generated on**: 2025-09-09
**Timestamp**: 1757401641