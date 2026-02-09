---
"lightfast": patch
"@lightfastai/mcp": patch
---

Fix API key format validation

The SDK was incorrectly validating API keys with the `sk_` prefix instead of the correct Lightfast format `sk-lf-`. This caused all API requests to fail with "Invalid API key format" errors.

**Breaking change for alpha users**: If you were using a workaround API key format, please update to use keys starting with `sk-lf-`.

Changes:
- Update API key validation to accept `sk-lf-` prefix
- Update all documentation and examples
- Update test cases to use correct format
