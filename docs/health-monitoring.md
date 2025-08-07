# Health Check Monitoring Configuration

## Overview

The health check endpoints (`/api/health`) are secured with Bearer token authentication to prevent unauthorized access while allowing legitimate monitoring services like BetterStack to check service availability.

## Security Features

- **Bearer Token Authentication**: When `HEALTH_CHECK_AUTH_TOKEN` is set, all health check requests must include a valid Bearer token
- **Constant-Time Token Comparison**: Prevents timing attacks
- **No Caching**: Health responses are never cached to ensure real-time status
- **Service Identification**: Returns service name and environment for multi-app monitoring

## Setup

### 1. Generate a Secure Token

```bash
# Run the provided script
./scripts/generate-health-token.sh

# Or generate manually
openssl rand -hex 32
```

### 2. Configure Environment Variable

Add the generated token to your `.env` file:

```env
HEALTH_CHECK_AUTH_TOKEN=your_generated_token_here
```

### 3. Configure BetterStack Uptime Monitor

In your BetterStack monitor settings:

1. **URL**: `https://your-domain.com/api/health`
2. **HTTP Method**: `GET`
3. **Request Headers**:
   - **Authorization**: `Bearer your_generated_token_here`
   - **User-Agent** (optional): `BetterStack-Monitor/1.0`
4. **Request Timeout**: 30 seconds (recommended)

## Available Endpoints

Each app has its own health endpoint that returns its service name:

| App | Endpoint | Service Name | Description |
|-----|----------|--------------|-------------|
| `apps/www` | `/api/health` | `www` | Main marketing site |
| `apps/app` | `/api/health` | `app` | Main application |
| `apps/auth` | `/api/health` | `auth` | Authentication service |
| `apps/playground` | `/api/health` | `playground` | AI playground |
| `apps/experimental` | `/api/health` | `experimental` | Experimental features |

All endpoints use the same authentication token when `HEALTH_CHECK_AUTH_TOKEN` is configured.

## Response Format

### Success Response (200 OK)
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "www",
  "environment": "production",
  "checks": {
    "api": "operational"
  }
}
```

### Unauthorized Response (401)
```json
{
  "error": "Unauthorized"
}
```

## Development Mode

During development, you can disable authentication by not setting the `HEALTH_CHECK_AUTH_TOKEN` environment variable. The endpoints will be publicly accessible.

## Security Best Practices

1. **Use Strong Tokens**: Always use cryptographically secure random tokens (minimum 32 bytes)
2. **Rotate Tokens Regularly**: Change tokens periodically, especially if exposed
3. **Monitor Access**: Review logs for unauthorized access attempts
4. **HTTPS Only**: Always use HTTPS in production to prevent token interception
5. **Limit IP Access**: Consider adding IP allowlisting for additional security

## Troubleshooting

### 401 Unauthorized
- Verify the token in your `.env` matches the one in BetterStack
- Check the Authorization header format: `Bearer <token>`
- Ensure no extra spaces or characters in the token

### Monitor Shows Down but Service is Running
- Check if the token is properly configured
- Verify the URL is correct and accessible
- Test manually with curl:

```bash
curl -H "Authorization: Bearer your_token_here" https://your-domain.com/api/health
```

## Additional Security Options

For enhanced security, you can also configure:

1. **IP Allowlisting**: Restrict access to BetterStack's IP ranges
2. **Rate Limiting**: Add rate limiting via Arcjet (already available in `@vendor/security`)
3. **Custom Headers**: Require additional custom headers for extra validation
4. **Webhook Validation**: Use webhook signatures for status change notifications