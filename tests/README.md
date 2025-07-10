# Testing Guide

This project uses Playwright for end-to-end testing and various testing approaches for different components.

## Playwright E2E Tests

### Setup

1. Install Playwright dependencies:
```bash
pnpm install
```

2. Install Playwright browsers:
```bash
pnpm playwright:install
```

3. Install system dependencies (Linux only):
```bash
pnpm playwright:install-deps
```

### Running Tests

```bash
# Run all E2E tests
pnpm test:e2e

# Run tests with UI mode
pnpm test:e2e:ui

# Run tests in headed mode (see browser)
pnpm test:e2e:headed

# Debug tests
pnpm test:e2e:debug
```

### Test Structure

- `tests/e2e/` - End-to-end tests using Playwright
- `playwright.config.ts` - Playwright configuration
- `.github/workflows/playwright.yml` - CI/CD pipeline for tests

### Writing Tests

Tests should follow these patterns:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Feature Name", () => {
	test("should do something", async ({ page }) => {
		await page.goto("/");
		
		// Your test logic here
		await expect(page.getByTestId("element")).toBeVisible();
	});
});
```

### Test Data Attributes

Use `data-testid` attributes for reliable element selection:

```tsx
<button data-testid="submit-button">Submit</button>
```

```typescript
await page.getByTestId("submit-button").click();
```

### MCP Integration

This project includes Playwright MCP server integration for enhanced testing capabilities:

- **Server**: `@executeautomation/playwright-mcp-server`
- **Configuration**: See `opencode.json` for MCP setup
- **Environment Variables**: 
  - `PLAYWRIGHT_HEADLESS=true`
  - `PLAYWRIGHT_TIMEOUT=30000`

### Best Practices

1. **Use Page Object Model** for complex pages
2. **Wait for elements** instead of using fixed timeouts
3. **Use data-testid** for element selection
4. **Test user journeys** not just individual components
5. **Keep tests independent** - each test should be able to run in isolation
6. **Use descriptive test names** that explain what is being tested

### Debugging

1. **Visual debugging**: Use `pnpm test:e2e:headed` to see tests run
2. **Debug mode**: Use `pnpm test:e2e:debug` to step through tests
3. **Screenshots**: Automatically taken on failure
4. **Traces**: Available for failed tests in CI

### CI/CD

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

Test reports are uploaded as artifacts and available for 30 days.

## Sandbox Tests

For testing the Vercel Sandbox integration:

```bash
# Run all sandbox tests
pnpm test:sandbox:all

# Run individual test suites
pnpm test:sandbox
pnpm test:sandbox:integration
pnpm test:sandbox:scenarios
```

## Environment Variables

Create `.env.test` for test-specific environment variables:

```bash
# Copy from .env.example and adjust for testing
cp .env.example .env.test
```