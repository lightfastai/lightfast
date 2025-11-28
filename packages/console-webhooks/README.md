# @repo/console-webhooks

Webhook signature verification utilities for Console integrations.

## Features

- ✅ **GitHub webhook verification** - HMAC SHA-256 signature verification
- ✅ **Timing-attack resistant** - Uses `crypto.timingSafeEqual()` for secure comparison
- ✅ **Replay attack prevention** - Validates webhook timestamps
- ✅ **Type-safe results** - Structured verification with detailed error messages
- ✅ **Pure functions** - No side effects, easy to test
- ✅ **Web Crypto API** - Uses standard Web Crypto for portability
- 🚧 **Linear webhook verification** - Stub for future implementation

## Installation

This is a workspace package. Add to your `package.json`:

```json
{
  "dependencies": {
    "@repo/console-webhooks": "workspace:*"
  }
}
```

## Usage

### GitHub Webhook Verification

```typescript
import { verifyGitHubWebhookFromHeaders } from "@repo/console-webhooks/github";

// In your webhook route handler (Next.js example)
export async function POST(request: NextRequest) {
  // 1. Get raw payload BEFORE parsing
  const rawPayload = await request.text();

  // 2. Verify signature
  const result = await verifyGitHubWebhookFromHeaders(
    rawPayload,
    request.headers,
    env.GITHUB_WEBHOOK_SECRET
  );

  // 3. Check verification result
  if (!result.verified) {
    console.error("Webhook verification failed:", result.error);
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  // 4. Process the verified event
  console.log("Repository:", result.event?.repository?.full_name);
  console.log("Action:", result.event?.action);

  // ... handle webhook event
  return NextResponse.json({ success: true });
}
```

### Manual Signature Verification

```typescript
import { verifyGitHubWebhook } from "@repo/console-webhooks/github";

const payload = '{"action":"opened","repository":{"id":123}}';
const signature = "sha256=abc123...";
const secret = "your-webhook-secret";

const result = await verifyGitHubWebhook(payload, signature, secret);

if (result.verified) {
  console.log("Event:", result.event);
} else {
  console.error("Error:", result.error);
}
```

### Using Common Utilities

```typescript
import {
  computeHmacSignature,
  safeCompareSignatures,
  validateWebhookTimestamp,
} from "@repo/console-webhooks/common";

// Compute HMAC signature
const signature = await computeHmacSignature(payload, secret);

// Compare signatures safely (timing-attack resistant)
const isValid = safeCompareSignatures(receivedSig, expectedSig);

// Validate timestamp (prevent replay attacks)
const isRecent = validateWebhookTimestamp("1640995200", 300); // 5 minutes
```

### Extract Webhook Metadata

```typescript
import { extractGitHubWebhookMetadata } from "@repo/console-webhooks/github";

const metadata = extractGitHubWebhookMetadata(request.headers);
console.log(`Delivery: ${metadata.deliveryId}, Event: ${metadata.eventType}`);
```

## API Reference

### GitHub Module (`@repo/console-webhooks/github`)

#### `verifyGitHubWebhook(payload, signature, secret)`

Verify GitHub webhook signature.

- **payload** (string): Raw webhook payload (not parsed)
- **signature** (string | null): X-Hub-Signature-256 header value
- **secret** (string): Your GitHub webhook secret
- **Returns**: `Promise<GitHubWebhookVerificationResult>`

#### `verifyGitHubWebhookFromHeaders(payload, headers, secret)`

Convenience wrapper that extracts signature from headers.

- **payload** (string): Raw webhook payload
- **headers** (Headers | Record): Request headers
- **secret** (string): Your GitHub webhook secret
- **Returns**: `Promise<GitHubWebhookVerificationResult>`

#### `extractGitHubWebhookMetadata(headers)`

Extract delivery ID and event type from headers.

- **headers** (Headers | Record): Request headers
- **Returns**: `{ deliveryId: string | null, eventType: string | null }`

### Common Module (`@repo/console-webhooks/common`)

#### `computeHmacSignature(payload, secret)`

Compute HMAC SHA-256 signature.

- **payload** (string): Data to sign
- **secret** (string): HMAC secret key
- **Returns**: `Promise<string>` (hex-encoded signature)

#### `safeCompareSignatures(received, expected)`

Compare signatures using timing-attack resistant comparison.

- **received** (string): Received signature
- **expected** (string): Expected signature
- **Returns**: `boolean`

#### `validateWebhookTimestamp(timestamp, maxAgeSeconds?)`

Validate webhook timestamp is recent.

- **timestamp** (string | number): Unix timestamp or ISO 8601 string
- **maxAgeSeconds** (number): Maximum age (default: 300 = 5 minutes)
- **Returns**: `boolean`

#### `safeParseJson<T>(jsonString)`

Parse JSON safely with structured error handling.

- **jsonString** (string): JSON string to parse
- **Returns**: `{ success: boolean, data?: T, error?: string }`

### Types Module (`@repo/console-webhooks/types`)

```typescript
interface WebhookVerificationResult<T> {
  verified: boolean;
  event?: T;
  error?: string;
}

interface GitHubWebhookEvent {
  action?: string;
  repository?: { id: number; name: string; full_name: string };
  installation?: { id: number };
  sender?: { login: string; id: number };
  [key: string]: unknown;
}

enum WebhookError {
  MISSING_SIGNATURE = "MISSING_SIGNATURE",
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  MISSING_PAYLOAD = "MISSING_PAYLOAD",
  INVALID_PAYLOAD = "INVALID_PAYLOAD",
  TIMESTAMP_TOO_OLD = "TIMESTAMP_TOO_OLD",
  TIMESTAMP_INVALID = "TIMESTAMP_INVALID",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}
```

## Security Best Practices

### 1. Always Verify Before Processing

```typescript
// ❌ DON'T: Parse before verifying
const body = await request.json();
const result = await verifyGitHubWebhook(JSON.stringify(body), signature, secret);

// ✅ DO: Verify raw payload first
const rawPayload = await request.text();
const result = await verifyGitHubWebhook(rawPayload, signature, secret);
if (result.verified) {
  // Now safe to use result.event
}
```

### 2. Use Timing-Safe Comparison

The package automatically uses `crypto.timingSafeEqual()` to prevent timing attacks. Never compare signatures with `===` or `==`.

### 3. Validate Timestamps

```typescript
// Add timestamp validation for extra security
const result = await verifyGitHubWebhookWithTimestamp(
  payload,
  signature,
  secret,
  { maxAgeSeconds: 300 } // Reject webhooks older than 5 minutes
);
```

### 4. Log Verification Failures

```typescript
if (!result.verified) {
  console.error("Webhook verification failed:", {
    error: result.error,
    deliveryId: extractGitHubWebhookMetadata(headers).deliveryId,
  });
  // Alert security team if seeing many failures
}
```

### 5. Rotate Secrets Regularly

Update your webhook secrets periodically and audit webhook configurations.

## Implementation Notes

### Why Raw Payload?

GitHub computes the signature over the raw request body. If you parse the JSON first and re-serialize it, the signature won't match because:
- JSON key ordering may change
- Whitespace may differ
- Number formatting may differ

Always call `request.text()` first, verify the signature, then parse the JSON.

### Why Timing-Safe Comparison?

Standard string comparison (`===`) returns as soon as it finds a mismatch. An attacker can measure response times to guess the signature byte-by-byte. `crypto.timingSafeEqual()` always takes the same time regardless of where differences occur.

### Why Timestamp Validation?

Even with signature verification, an attacker could replay a captured valid webhook. Timestamp validation ensures webhooks are recent, preventing replay attacks.

## Future Enhancements

- [ ] Linear webhook verification (currently a stub)
- [ ] Slack webhook verification
- [ ] Discord webhook verification
- [ ] Generic HMAC webhook verification helper
- [ ] Webhook event type validation with Zod

## Related Packages

- `@repo/console-api-key` - API key generation and hashing
- `@repo/console-oauth` - OAuth state management (planned)
- `@repo/console-auth-middleware` - tRPC auth middleware (planned)

## References

- [GitHub Webhook Security](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [OWASP: Timing Attacks](https://owasp.org/www-community/attacks/Timing_attack)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
