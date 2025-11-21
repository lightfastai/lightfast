# @repo/console-oauth

OAuth security utilities for the Console application, providing cryptographic operations for secure OAuth flows.

## Features

- **OAuth State Management** - Generate and validate OAuth state with expiration and replay protection
- **PKCE Support** - Proof Key for Code Exchange (RFC 7636) for OAuth 2.1
- **Token Encryption** - AES-256-GCM encryption for secure token storage
- **Web Crypto API** - All cryptographic operations use browser-compatible Web Crypto
- **Type-Safe** - Full TypeScript support with comprehensive types
- **Security-First** - Constant-time comparisons, secure random generation, authenticated encryption

## Installation

This is a workspace package - add to your `package.json`:

```json
{
  "dependencies": {
    "@repo/console-oauth": "workspace:*"
  }
}
```

## Usage

### OAuth State Generation and Validation

OAuth state prevents CSRF attacks by validating that authorization responses match requests.

**Generate State (Authorization Request)**

```typescript
import { generateOAuthState } from "@repo/console-oauth";

// Generate state with optional redirect path
const { state, encoded } = generateOAuthState({
  redirectPath: "/settings/integrations",
});

// Store in httpOnly cookie
response.cookies.set("oauth_state", encoded, {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: 600, // 10 minutes
});

// Redirect to OAuth provider
const authUrl = new URL("https://github.com/login/oauth/authorize");
authUrl.searchParams.set("client_id", GITHUB_CLIENT_ID);
authUrl.searchParams.set("state", state.token);
return redirect(authUrl.toString());
```

**Validate State (OAuth Callback)**

```typescript
import { validateOAuthState } from "@repo/console-oauth";

// In OAuth callback handler
const receivedState = request.nextUrl.searchParams.get("state");
const storedState = request.cookies.get("oauth_state")?.value;

const result = validateOAuthState(receivedState, storedState, {
  maxAgeMs: 10 * 60 * 1000, // 10 minutes
  markAsUsed: true, // Prevent replay attacks
});

if (!result.valid) {
  return redirect(`/?error=invalid_state&reason=${result.error}`);
}

// State is valid - delete cookie and proceed
response.cookies.delete("oauth_state");

const redirectPath = result.state?.redirectPath ?? "/";
// Continue with OAuth flow...
```

### PKCE (Proof Key for Code Exchange)

PKCE prevents authorization code interception attacks for OAuth 2.1.

**Generate PKCE Challenge (Authorization Request)**

```typescript
import { generatePKCEChallenge } from "@repo/console-oauth";

// Generate PKCE challenge
const pkce = await generatePKCEChallenge();

// Store code verifier in httpOnly cookie
response.cookies.set("pkce_verifier", pkce.codeVerifier, {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: 600,
});

// Send code challenge to OAuth provider
const authUrl = new URL("https://github.com/login/oauth/authorize");
authUrl.searchParams.set("client_id", GITHUB_CLIENT_ID);
authUrl.searchParams.set("code_challenge", pkce.codeChallenge);
authUrl.searchParams.set("code_challenge_method", "S256");
return redirect(authUrl.toString());
```

**Verify PKCE (Token Exchange)**

```typescript
import { verifyPKCEChallenge } from "@repo/console-oauth";

// In OAuth callback handler
const storedVerifier = request.cookies.get("pkce_verifier")?.value;

if (!storedVerifier) {
  return redirect("/?error=missing_pkce");
}

// Exchange authorization code for token (includes code_verifier)
const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    client_id: GITHUB_CLIENT_ID,
    client_secret: GITHUB_CLIENT_SECRET,
    code: authorizationCode,
    code_verifier: storedVerifier, // Provider verifies this
  }),
});

// Delete verifier cookie
response.cookies.delete("pkce_verifier");
```

### Token Encryption

Encrypt OAuth tokens before storing in cookies to prevent theft.

**Encrypt Token**

```typescript
import { encryptOAuthTokenToCookie } from "@repo/console-oauth";

// After receiving access token from OAuth provider
const accessToken = "ghp_abc123xyz789...";

// Encrypt token (single string for cookie)
const encryptedToken = await encryptOAuthTokenToCookie(
  accessToken,
  process.env.ENCRYPTION_KEY // 64 hex chars or 44 base64 chars
);

// Store encrypted token in cookie
response.cookies.set("github_token", encryptedToken, {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: 300, // 5 minutes
  path: "/api/github", // Restrict to specific path
});
```

**Decrypt Token**

```typescript
import { decryptOAuthTokenFromCookie } from "@repo/console-oauth";

// Retrieve and decrypt token
const encryptedCookie = request.cookies.get("github_token")?.value;

if (!encryptedCookie) {
  return new Response("Unauthorized", { status: 401 });
}

try {
  const accessToken = await decryptOAuthTokenFromCookie(
    encryptedCookie,
    process.env.ENCRYPTION_KEY
  );

  // Use decrypted token to make API calls
  const response = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
} catch (error) {
  // Decryption failed - token tampered or wrong key
  return new Response("Invalid token", { status: 401 });
}
```

## Complete GitHub OAuth Flow Example

Here's a complete example implementing all security features:

**Authorization Route (`/api/github/auth/route.ts`)**

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  generateOAuthState,
  generatePKCEChallenge,
} from "@repo/console-oauth";

export async function GET(request: NextRequest) {
  const redirectPath = request.nextUrl.searchParams.get("redirect") ?? "/";

  // Generate OAuth state
  const { state, encoded } = generateOAuthState({ redirectPath });

  // Generate PKCE challenge
  const pkce = await generatePKCEChallenge();

  // Store state and verifier in cookies
  const response = NextResponse.redirect(authUrl);
  response.cookies.set("oauth_state", encoded, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 600,
  });
  response.cookies.set("pkce_verifier", pkce.codeVerifier, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 600,
  });

  // Redirect to GitHub
  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID!);
  authUrl.searchParams.set("state", state.token);
  authUrl.searchParams.set("code_challenge", pkce.codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("scope", "repo user:email");

  return NextResponse.redirect(authUrl);
}
```

**Callback Route (`/api/github/callback/route.ts`)**

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  validateOAuthState,
  encryptOAuthTokenToCookie,
} from "@repo/console-oauth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const receivedState = request.nextUrl.searchParams.get("state");

  // Validate OAuth state
  const storedState = request.cookies.get("oauth_state")?.value;
  const stateResult = validateOAuthState(receivedState, storedState);

  if (!stateResult.valid) {
    return NextResponse.redirect(
      `${baseUrl}/?error=invalid_state&reason=${stateResult.error}`
    );
  }

  // Exchange code for token
  const storedVerifier = request.cookies.get("pkce_verifier")?.value;
  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        code_verifier: storedVerifier,
      }),
    }
  );

  const { access_token } = await tokenResponse.json();

  // Encrypt token before storing
  const encryptedToken = await encryptOAuthTokenToCookie(
    access_token,
    process.env.ENCRYPTION_KEY!
  );

  // Redirect with encrypted token
  const redirectPath = stateResult.state?.redirectPath ?? "/";
  const response = NextResponse.redirect(`${baseUrl}${redirectPath}`);

  // Delete OAuth cookies
  response.cookies.delete("oauth_state");
  response.cookies.delete("pkce_verifier");

  // Set encrypted token cookie
  response.cookies.set("github_token", encryptedToken, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    maxAge: 300, // 5 minutes
    path: "/api/github",
  });

  return response;
}
```

## API Reference

### OAuth State

#### `generateOAuthState(options?)`

Generate OAuth state with security features.

**Parameters:**
- `options.redirectPath` (optional) - Path to redirect after OAuth completion

**Returns:**
- `state` - OAuth state object
- `encoded` - Base64URL-encoded string for cookie storage

#### `validateOAuthState(received, stored, options?)`

Validate OAuth state with security checks.

**Parameters:**
- `received` - State received from OAuth provider
- `stored` - State stored in cookie/session
- `options.maxAgeMs` (optional) - Maximum age in ms (default: 10 minutes)
- `options.markAsUsed` (optional) - Mark nonce as used (default: true)

**Returns:**
- `valid` - Whether state is valid
- `error` - Error type if validation failed
- `state` - Decoded state object if valid

### PKCE

#### `generatePKCEChallenge(length?)`

Generate PKCE challenge for OAuth 2.1.

**Parameters:**
- `length` (optional) - Code verifier length (default: 64, min: 43, max: 128)

**Returns:**
- `codeVerifier` - Random verifier string (store securely)
- `codeChallenge` - SHA-256 hash of verifier (send to provider)
- `codeChallengeMethod` - Always "S256"

#### `verifyPKCEChallenge(verifier, challenge)`

Verify PKCE code verifier against challenge.

**Parameters:**
- `verifier` - Code verifier from client
- `challenge` - Expected code challenge

**Returns:** `boolean` - True if verification succeeds

### Token Encryption

#### `encryptOAuthToken(token, key)`

Encrypt OAuth token using AES-256-GCM.

**Parameters:**
- `token` - Plaintext token to encrypt
- `key` - 32-byte encryption key (64 hex chars or 44 base64 chars)

**Returns:**
- `encryptedToken` - Base64-encoded ciphertext
- `iv` - Base64-encoded initialization vector
- `authTag` - Base64-encoded authentication tag

#### `decryptOAuthToken(encrypted, key)`

Decrypt OAuth token.

**Parameters:**
- `encrypted` - Encrypted token object
- `key` - Encryption key (same as used for encryption)

**Returns:** `string` - Decrypted plaintext token

#### `encryptOAuthTokenToCookie(token, key)`

Convenience function: encrypt and encode to single string.

#### `decryptOAuthTokenFromCookie(cookieValue, key)`

Convenience function: parse and decrypt from cookie string.

## Environment Variables

### Required

```bash
# 32-byte encryption key for token encryption
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

### Optional

```bash
# OAuth state expiration (default: 600000ms = 10 minutes)
OAUTH_STATE_MAX_AGE_MS=600000
```

## Security Considerations

### OAuth State

- **10-minute expiration** - States expire after 10 minutes (configurable)
- **One-time use** - Nonces prevent replay attacks
- **Constant-time comparison** - Prevents timing attacks
- **Base64URL encoding** - Cookie-safe encoding

### PKCE

- **SHA-256 challenge** - Uses S256 method (SHA-256)
- **43-128 character verifier** - Complies with RFC 7636
- **Random generation** - Web Crypto API for secure randomness

### Token Encryption

- **AES-256-GCM** - Authenticated encryption with integrity verification
- **Random IV** - New IV per encryption
- **Authentication tag** - Detects tampering
- **Secure key derivation** - Validates key format before use

### Best Practices

1. **Always use HTTPS** - Even in development
2. **Set secure cookies** - `httpOnly: true, secure: true, sameSite: "strict"`
3. **Restrict cookie paths** - Limit exposure with `path` attribute
4. **Short token lifetime** - 5 minutes max for temporary tokens
5. **Rotate encryption keys** - Periodically update encryption keys
6. **Delete used cookies** - Remove state/verifier after validation
7. **Validate all inputs** - Never trust client-provided data

## Testing

```bash
# Type check
pnpm typecheck

# Build
pnpm build

# Clean
pnpm clean
```

## License

Private - part of Lightfast monorepo
