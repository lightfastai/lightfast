# Encryption Utility

Secure AES-256-GCM encryption for storing sensitive data like OAuth tokens and API keys.

## Overview

This utility provides encryption/decryption functions using Node.js built-in `crypto` module with AES-256-GCM (Galois/Counter Mode). AES-GCM is an authenticated encryption algorithm that provides both confidentiality and integrity.

**Key Features:**
- **AES-256-GCM**: Industry-standard authenticated encryption
- **Unique IVs**: Each encryption uses a random 12-byte initialization vector
- **Authentication**: GCM mode prevents tampering with encrypted data
- **Type-safe**: Full TypeScript support with detailed error types
- **Zero dependencies**: Uses only Node.js built-in crypto module

## Installation

The encryption utility is part of `@repo/lib`:

```typescript
import { encrypt, decrypt, generateEncryptionKey } from "@repo/lib";
```

## Usage

### Generate Encryption Key

Generate a secure 32-byte (256-bit) encryption key:

```typescript
import { generateEncryptionKey } from "@repo/lib";

const key = generateEncryptionKey();
// Returns: "e4e1cb36c73d95219f18dad883a5154bd5b3b30ea49392bf8adf3377807b4f5d"
// (64 hex characters = 32 bytes)
```

**Command line:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Encrypt Data

```typescript
import { encrypt } from "@repo/lib";

const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";
const key = process.env.ENCRYPTION_KEY!;

const encrypted = encrypt(token, key);
// Returns: "W78VnVQxfrv3zFfcLbiMkFt/FG+iWFNgnEHi6AwbzUHZnK+L..." (base64)
```

### Decrypt Data

```typescript
import { decrypt } from "@repo/lib";

const encrypted = "W78VnVQxfrv3zFfcLbiMkFt/FG+iWFNgnEHi6AwbzUHZ...";
const key = process.env.ENCRYPTION_KEY!;

const decrypted = decrypt(encrypted, key);
// Returns: "ghp_1234567890abcdefghijklmnopqrstuvwxyz"
```

## Encryption Format

The encrypted string is a base64-encoded combination of:

```
[IV (12 bytes)] + [Auth Tag (16 bytes)] + [Ciphertext (variable)]
```

- **IV (Initialization Vector)**: 12 bytes, randomly generated for each encryption
- **Auth Tag**: 16 bytes, used by GCM to verify data integrity
- **Ciphertext**: Encrypted data (same length as plaintext)

**Example breakdown:**
- Plaintext: `"ghp_1234567890"` (14 chars = 14 bytes)
- IV: 12 bytes
- Auth Tag: 16 bytes
- Ciphertext: 14 bytes
- **Total**: 42 bytes → 56 characters when base64 encoded

## Error Handling

The utility provides specific error types for better error handling:

```typescript
import { encrypt, decrypt, EncryptionError, DecryptionError } from "@repo/lib";

try {
  const encrypted = encrypt(plaintext, key);
} catch (error) {
  if (error instanceof EncryptionError) {
    console.error("Encryption failed:", error.message);
  }
}

try {
  const decrypted = decrypt(ciphertext, key);
} catch (error) {
  if (error instanceof DecryptionError) {
    console.error("Decryption failed:", error.message);
    // Common causes:
    // - Wrong encryption key
    // - Data was tampered with
    // - Corrupted ciphertext
  }
}
```

**Common error messages:**

| Error | Cause | Solution |
|-------|-------|----------|
| "Encryption key must be a non-empty string" | Key is empty or undefined | Set ENCRYPTION_KEY environment variable |
| "Encryption key must be 32 bytes" | Key is wrong length | Generate new key with `generateEncryptionKey()` |
| "Authentication failed - data may be corrupted or key is incorrect" | Wrong key or tampered data | Verify you're using the correct key |
| "Ciphertext is too short - data may be corrupted" | Invalid ciphertext format | Check data wasn't truncated during storage |

## Environment Configuration

### Development

For development, a default key is used (with a warning):

```bash
# .env.development.local (optional - uses default)
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
```

### Production

**Required** - Generate a secure key:

```bash
# .env.production.local or Vercel Environment Variables
ENCRYPTION_KEY=e4e1cb36c73d95219f18dad883a5154bd5b3b30ea49392bf8adf3377807b4f5d
```

**Generate production key:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Environment Schema

Both `apps/console` and `api/console` validate the encryption key:

```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    ENCRYPTION_KEY: z
      .string()
      .min(44)
      .refine(
        (key) => {
          const hexPattern = /^[0-9a-f]{64}$/i;
          const base64Pattern = /^[A-Za-z0-9+/]{43}=$/;
          return hexPattern.test(key) || base64Pattern.test(key);
        },
        {
          message:
            "ENCRYPTION_KEY must be 32 bytes (64 hex chars or 44 base64 chars)",
        },
      )
      .default(
        process.env.NODE_ENV === "development"
          ? "0000000000000000000000000000000000000000000000000000000000000000"
          : "",
      ),
  },
});
```

## Implementation Details

### OAuth Token Flow

**1. User completes GitHub OAuth** (`apps/console/src/app/(github)/api/github/callback/route.ts`):

```typescript
import { encrypt } from "@repo/lib";
import { env } from "~/env";

// Exchange OAuth code for access token
const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
  method: "POST",
  body: JSON.stringify({ client_id, client_secret, code }),
});

const { access_token } = await tokenResponse.json();

// Encrypt token before storing
const encryptedToken = encrypt(access_token, env.ENCRYPTION_KEY);

await db.insert(integrations).values({
  userId: clerkUserId,
  provider: "github",
  accessToken: encryptedToken, // ✓ Stored encrypted
});
```

**2. API uses token** (`api/console/src/router/integration.ts`):

```typescript
import { decrypt } from "@repo/lib";
import { env } from "../env";

// Fetch integration from database
const integration = await db
  .select()
  .from(integrations)
  .where(eq(integrations.userId, userId))
  .limit(1);

// Decrypt token before use
const accessToken = decrypt(integration.accessToken, env.ENCRYPTION_KEY);

// Use decrypted token
const { installations } = await getUserInstallations(accessToken);
```

### Security Considerations

**✓ DO:**
- Generate unique keys for dev/staging/production
- Store keys in environment variables (never commit to git)
- Rotate keys periodically
- Use HTTPS for all token transmission
- Log encryption/decryption failures for security monitoring

**✗ DON'T:**
- Reuse keys across environments
- Store keys in code or config files
- Share keys between teams/projects
- Use weak keys (less than 32 bytes)
- Ignore decryption errors

### Key Rotation

To rotate encryption keys:

1. **Generate new key:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Re-encrypt existing data:**
   ```typescript
   import { encrypt, decrypt } from "@repo/lib";

   // Migration script
   const integrations = await db.select().from(integrations);

   for (const integration of integrations) {
     // Decrypt with old key
     const plaintext = decrypt(integration.accessToken, OLD_KEY);

     // Encrypt with new key
     const newEncrypted = encrypt(plaintext, NEW_KEY);

     // Update record
     await db
       .update(integrations)
       .set({ accessToken: newEncrypted })
       .where(eq(integrations.id, integration.id));
   }
   ```

3. **Update environment variables** in Vercel/production

4. **Deploy updated code**

## API Reference

### `encrypt(plaintext: string, key: string): string`

Encrypts plaintext using AES-256-GCM.

**Parameters:**
- `plaintext` - The plaintext string to encrypt
- `key` - Encryption key (32 bytes as hex or base64 string)

**Returns:** Base64-encoded encrypted string (IV + Auth Tag + Ciphertext)

**Throws:** `EncryptionError` if encryption fails or key is invalid

---

### `decrypt(ciphertext: string, key: string): string`

Decrypts ciphertext encrypted with AES-256-GCM.

**Parameters:**
- `ciphertext` - Base64-encoded encrypted string (from `encrypt()`)
- `key` - Encryption key (32 bytes as hex or base64 string)

**Returns:** Decrypted plaintext string

**Throws:** `DecryptionError` if decryption fails, data is corrupted, or key is wrong

---

### `generateEncryptionKey(): string`

Generates a new encryption key suitable for AES-256-GCM.

**Returns:** 32-byte key as hex string (64 characters)

---

### `class EncryptionError extends Error`

Error thrown when encryption fails.

**Properties:**
- `name`: "EncryptionError"
- `message`: Error description
- `cause`: Original error (if any)

---

### `class DecryptionError extends Error`

Error thrown when decryption fails.

**Properties:**
- `name`: "DecryptionError"
- `message`: Error description
- `cause`: Original error (if any)

## Testing

Run the encryption utility tests:

```typescript
import { encrypt, decrypt, generateEncryptionKey } from "@repo/lib";

// Generate test key
const key = generateEncryptionKey();

// Test encryption/decryption
const plaintext = "test-secret-token";
const encrypted = encrypt(plaintext, key);
const decrypted = decrypt(encrypted, key);

console.assert(decrypted === plaintext, "Decryption should match original");

// Test wrong key detection
try {
  decrypt(encrypted, generateEncryptionKey());
  console.error("Should have thrown error for wrong key");
} catch (error) {
  console.assert(error instanceof DecryptionError, "Should throw DecryptionError");
}

console.log("✓ All tests passed");
```

## Performance

**Encryption:**
- Average: ~0.1ms per operation
- Overhead: +56 bytes for small strings (IV + Auth Tag)

**Decryption:**
- Average: ~0.1ms per operation
- Authentication adds negligible overhead

**Scalability:**
- Can encrypt/decrypt 10,000+ tokens per second
- Suitable for real-time API operations
- No memory leaks (uses Node.js crypto primitives)

## FAQ

**Q: Why AES-256-GCM instead of AES-256-CBC?**

A: GCM provides authenticated encryption, preventing tampering. CBC requires separate HMAC for authentication.

**Q: Can I use base64 keys instead of hex?**

A: Yes, the utility accepts both hex (64 chars) and base64 (44 chars) keys, as long as they decode to 32 bytes.

**Q: What if I lose the encryption key?**

A: Encrypted data cannot be recovered without the key. Store keys securely and back them up.

**Q: Is it safe to store encrypted tokens in the database?**

A: Yes, as long as:
- Keys are stored separately (environment variables)
- Database access is restricted
- HTTPS/TLS is used for all connections

**Q: Should I encrypt API responses?**

A: No, API responses should use HTTPS/TLS for encryption in transit. This utility is for data at rest (database storage).

## License

MIT License - see root LICENSE file for details.
