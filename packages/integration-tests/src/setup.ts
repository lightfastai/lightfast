/**
 * Global test setup for integration tests.
 *
 * Runs before every test file in this package. Sets env vars that all three
 * service apps need at module-load time, so env validation passes even though
 * we're mocking the actual external services.
 */

// Suppress @t3-oss/env-core validation — we control values via process.env
process.env.SKIP_ENV_VALIDATION = "true";

// Shared auth key used by all three services
// Must be a valid hex string — gateway's timingSafeEqual uses hexToBytes()
process.env.GATEWAY_API_KEY = "0".repeat(64);

// Connections app
process.env.ENCRYPTION_KEY = "a".repeat(64); // 64-char hex for token encryption

// Backfill app
process.env.INNGEST_APP_NAME = "lightfast-test";

// Gateway app
process.env.GATEWAY_WEBHOOK_SECRET = "test-webhook-secret";
process.env.GITHUB_WEBHOOK_SECRET = "gh-secret";
process.env.VERCEL_CLIENT_INTEGRATION_SECRET = "vc-secret";
process.env.LINEAR_WEBHOOK_SIGNING_SECRET = "ln-secret";
process.env.SENTRY_CLIENT_SECRET = "sn-secret";

// api/console env vars — Clerk is mocked, but these prevent module-level validation failures
process.env.NEXT_PUBLIC_VERCEL_ENV = "development";
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_placeholder";
process.env.CLERK_SECRET_KEY = "sk_test_placeholder";

// Vendor placeholders — mocked at test time, these just prevent env errors
process.env.KV_REST_API_URL = "https://redis.test";
process.env.KV_REST_API_TOKEN = "test-redis-token";
process.env.QSTASH_URL = "https://qstash.test";
process.env.QSTASH_TOKEN = "test-qstash-token";
process.env.QSTASH_CURRENT_SIGNING_KEY = "test-signing-key";
process.env.QSTASH_NEXT_SIGNING_KEY = "test-signing-key-next";
process.env.DATABASE_HOST = "test-db-host";
process.env.DATABASE_USERNAME = "test-db-user";
process.env.DATABASE_PASSWORD = "test-db-pass";
