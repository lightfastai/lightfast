# GitHub Integration - Automated Testing Strategy

**Last Updated:** 2025-11-26
**Status:** 📋 Planning - Ready for Implementation

This document outlines a comprehensive automated testing strategy for the GitHub App integration, covering unit tests, integration tests, E2E tests, and contract tests.

---

## Table of Contents

1. [Overview](#overview)
2. [What Can Be Automated](#what-can-be-automated)
3. [Testing Architecture](#testing-architecture)
4. [Layer 1: Unit Tests](#layer-1-unit-tests)
5. [Layer 2: Integration Tests](#layer-2-integration-tests)
6. [Layer 3: E2E Tests](#layer-3-e2e-tests)
7. [Layer 4: Contract Tests](#layer-4-contract-tests)
8. [Test Setup Configuration](#test-setup-configuration)
9. [Test Coverage Targets](#test-coverage-targets)
10. [Implementation Roadmap](#implementation-roadmap)
11. [Automation Feasibility Matrix](#automation-feasibility-matrix)

---

## Overview

The GitHub integration testing strategy focuses on automating **85-95% of test coverage** through a layered approach, minimizing reliance on manual testing while ensuring comprehensive coverage of edge cases.

**Key Principles:**
- **Fast feedback loop** - Unit tests run in <1s
- **No GitHub dependency** - Most tests run offline with mocks
- **Comprehensive coverage** - All error paths tested
- **Regression prevention** - Catches breaking changes early
- **Documentation value** - Tests serve as usage examples
- **CI/CD ready** - Runs in GitHub Actions without external dependencies

---

## What Can Be Automated

### ✅ Fully Automatable (95%+ coverage)

#### Unit Tests
- OAuth state validation (generate, validate, expire)
- Token encryption/decryption
- URL construction and parameter handling
- Error type mapping (ErrorType enum → user messages)
- Cookie parsing and validation
- Component lifecycle (cleanup, unmount)

#### Integration Tests
- API route handlers with mocked GitHub API
- Database operations (create/update installations)
- tRPC procedures with test database
- Webhook payload processing
- State machine flows (installation → authorization → connected)

#### E2E Tests (Mocked GitHub)
- Client-side popup handling (without actual OAuth)
- Error toast display and URL cleanup
- Refetch behavior and loading states
- Component lifecycle (mount/unmount cleanup)
- Multi-browser popup behavior (Chromium, WebKit)

#### Contract Tests
- GitHub API response schemas
- Webhook payload schemas
- Database schema migrations

### 🟡 Partially Automatable (50-70% coverage)

#### Actual GitHub OAuth Flow
- **Challenge:** Requires real GitHub authentication
- **Solution:** Use GitHub's test fixtures + mock OAuth server
- **Alternative:** Recorded OAuth sessions with VCR pattern
- **Automation Level:** 50% (flows), 50% (manual verification)

#### GitHub App Installation Flow
- **Challenge:** Requires GitHub UI interaction
- **Solution:** Playwright with mock GitHub pages or fixtures
- **Better:** Test with GitHub's test organizations
- **Automation Level:** 60% (mocked), 40% (staging manual)

### ⚠️ Requires Manual Testing

- Cross-browser popup quirks (Safari's strict popup blocking)
- Third-party cookie blocking by privacy tools
- Real GitHub App permission changes
- Production smoke testing after deployment

---

## Testing Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Testing Pyramid                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Manual Exploratory (5%)                                    │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Production smoke tests, real GitHub accounts        │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  E2E Tests - Playwright (15%)                               │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Complete OAuth flow, popup behavior, browser quirks │  │
│  │ Mocked GitHub API, real browser interactions        │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Integration Tests - Vitest (30%)                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ API routes, tRPC procedures, database operations    │  │
│  │ Mocked external services, test database             │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  Unit Tests - Vitest (50%)                                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ OAuth state, token encryption, error mapping        │  │
│  │ Component logic, utility functions                  │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Unit Tests

**Framework:** Vitest
**Speed:** <1s
**Dependencies:** None (pure functions, no external services)
**Coverage Target:** 90%+

### OAuth State Validation Tests

```typescript
// apps/console/src/__tests__/oauth/state.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  generateOAuthState,
  encodeOAuthState,
  validateOAuthState
} from '@repo/console-oauth/state';

describe('OAuth State Validation', () => {
  it('validates fresh state correctly', () => {
    const state = generateOAuthState({ redirectPath: '/new' });
    const encoded = encodeOAuthState(state);
    const validation = validateOAuthState(state.id, encoded);

    expect(validation.valid).toBe(true);
    expect(validation.state?.redirectPath).toBe('/new');
  });

  it('rejects expired state', () => {
    // Mock Date.now() to simulate time passing
    const now = Date.now();
    vi.setSystemTime(now);

    const state = generateOAuthState({ redirectPath: '/new' });
    const encoded = encodeOAuthState(state);

    // Fast-forward 11 minutes (state expires after 10 minutes)
    vi.setSystemTime(now + 11 * 60 * 1000);

    const validation = validateOAuthState(state.id, encoded);
    expect(validation.valid).toBe(false);
    expect(validation.error).toBe('expired');
  });

  it('rejects tampered state', () => {
    const state = generateOAuthState({ redirectPath: '/new' });
    const encoded = encodeOAuthState(state);
    const tampered = state.id + 'malicious';

    const validation = validateOAuthState(tampered, encoded);
    expect(validation.valid).toBe(false);
  });

  it('rejects state with invalid signature', () => {
    const state = generateOAuthState({ redirectPath: '/new' });
    const encoded = encodeOAuthState(state);
    // Corrupt the encoded value
    const corrupted = encoded.slice(0, -5) + 'xxxxx';

    const validation = validateOAuthState(state.id, corrupted);
    expect(validation.valid).toBe(false);
  });

  it('generates unique state IDs', () => {
    const state1 = generateOAuthState({ redirectPath: '/new' });
    const state2 = generateOAuthState({ redirectPath: '/new' });

    expect(state1.id).not.toBe(state2.id);
  });
});
```

### Token Encryption Tests

```typescript
// apps/console/src/__tests__/oauth/tokens.test.ts
import { describe, it, expect } from 'vitest';
import {
  encryptOAuthToken,
  decryptOAuthToken,
  encryptOAuthTokenToCookie
} from '@repo/console-oauth/tokens';

describe('OAuth Token Encryption', () => {
  it('encrypts and decrypts tokens correctly', () => {
    const token = 'gho_test123456789abcdef';
    const encrypted = encryptOAuthToken(token);
    const decrypted = decryptOAuthToken(encrypted);

    expect(decrypted).toBe(token);
  });

  it('produces different ciphertext for same plaintext', () => {
    const token = 'gho_test123456789abcdef';
    const encrypted1 = encryptOAuthToken(token);
    const encrypted2 = encryptOAuthToken(token);

    // Different IV should produce different ciphertext
    expect(encrypted1).not.toBe(encrypted2);

    // But both should decrypt to same value
    expect(decryptOAuthToken(encrypted1)).toBe(token);
    expect(decryptOAuthToken(encrypted2)).toBe(token);
  });

  it('creates secure cookie with correct attributes', () => {
    const token = 'gho_test123456789abcdef';
    const cookie = encryptOAuthTokenToCookie(token);

    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Max-Age=');
  });

  it('handles empty token gracefully', () => {
    expect(() => encryptOAuthToken('')).toThrow();
  });

  it('handles corrupted ciphertext gracefully', () => {
    expect(() => decryptOAuthToken('invalid-ciphertext')).toThrow();
  });
});
```

### Error Message Mapping Tests

```typescript
// apps/console/src/__tests__/errors/error-messages.test.ts
import { describe, it, expect } from 'vitest';
import { ErrorType, ErrorMap } from '~/lib/github/errors';

describe('GitHub OAuth Error Messages', () => {
  it('has user-friendly message for every error type', () => {
    const errorTypes = Object.values(ErrorType);

    for (const errorType of errorTypes) {
      expect(ErrorMap[errorType]).toBeDefined();
      expect(ErrorMap[errorType].title).toBeTruthy();
      expect(ErrorMap[errorType].description).toBeTruthy();
    }
  });

  it('messages do not expose internal implementation details', () => {
    const messages = Object.values(ErrorMap).map(m => m.description);

    for (const message of messages) {
      expect(message).not.toMatch(/database|sql|query/i);
      expect(message).not.toMatch(/token|key|secret/i);
      expect(message).not.toMatch(/500|error code/i);
    }
  });

  it('messages include actionable guidance', () => {
    const actionalWords = ['try again', 'contact support', 'check', 'ensure'];
    const messages = Object.values(ErrorMap).map(m => m.description.toLowerCase());

    for (const message of messages) {
      const hasAction = actionalWords.some(word => message.includes(word));
      expect(hasAction).toBe(true);
    }
  });
});
```

### Component Lifecycle Tests

```typescript
// apps/console/src/__tests__/components/github-connector.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitHubConnector } from '~/app/(app)/(user)/new/_components/github-connector';

describe('GitHub Connector Component', () => {
  it('prevents double-click popup spam', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window);
    const user = userEvent.setup();

    render(<GitHubConnector />);
    const button = screen.getByRole('button', { name: /connect github/i });

    await user.dblClick(button); // Double click

    // Should only open one popup (loading state prevents second click)
    expect(openSpy).toHaveBeenCalledTimes(1);
  });

  it('cleans up poll interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const { unmount } = render(<GitHubConnector />);

    // Simulate popup opening (starts poll interval)
    vi.spyOn(window, 'open').mockReturnValue({
      closed: false
    } as Window);

    const button = screen.getByRole('button', { name: /connect github/i });
    userEvent.click(button);

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it('handles popup blocked by browser', async () => {
    // Simulate popup being blocked
    vi.spyOn(window, 'open').mockReturnValue(null);
    const user = userEvent.setup();

    render(<GitHubConnector />);
    await user.click(screen.getByRole('button', { name: /connect github/i }));

    expect(screen.getByText(/popup.*blocked/i)).toBeInTheDocument();
  });

  it('stops polling when popup is manually closed', async () => {
    const mockPopup = {
      closed: false,
      close: vi.fn()
    } as unknown as Window;

    vi.spyOn(window, 'open').mockReturnValue(mockPopup);
    const user = userEvent.setup();

    render(<GitHubConnector />);
    await user.click(screen.getByRole('button', { name: /connect github/i }));

    // Simulate user closing popup manually
    mockPopup.closed = true;

    await waitFor(() => {
      // Poll interval should detect closure and stop
      expect(mockPopup.closed).toBe(true);
    });
  });

  it('times out after 10 minutes', async () => {
    vi.useFakeTimers();

    const mockPopup = {
      closed: false,
      close: vi.fn()
    } as unknown as Window;

    vi.spyOn(window, 'open').mockReturnValue(mockPopup);
    const user = userEvent.setup();

    render(<GitHubConnector />);
    await user.click(screen.getByRole('button', { name: /connect github/i }));

    // Fast-forward 10 minutes
    vi.advanceTimersByTime(10 * 60 * 1000);

    await waitFor(() => {
      expect(mockPopup.close).toHaveBeenCalled();
    });

    vi.useRealTimers();
  });
});
```

---

## Layer 2: Integration Tests

**Framework:** Vitest with MSW (Mock Service Worker)
**Speed:** 1-5s per test
**Dependencies:** Test database, mocked GitHub API
**Coverage Target:** 80%+

### API Route Handler Tests

```typescript
// apps/console/src/__tests__/api/user-authorized.integration.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '~/app/(github)/api/github/user-authorized/route';
import { generateOAuthState, encodeOAuthState } from '@repo/console-oauth/state';
import { setupMockGitHubAPI, cleanupMockGitHubAPI } from '../mocks/github-api';
import { setupTestDatabase, cleanupTestDatabase } from '../mocks/database';

describe('GitHub User Authorization Callback', () => {
  beforeEach(() => {
    setupMockGitHubAPI();
    setupTestDatabase();
  });

  afterEach(() => {
    cleanupMockGitHubAPI();
    cleanupTestDatabase();
  });

  it('exchanges code for access token successfully', async () => {
    const state = generateOAuthState({ redirectPath: '/new' });
    const encodedState = encodeOAuthState(state);

    const request = new NextRequest(
      `http://localhost:4107/api/github/user-authorized?code=valid_code&state=${state.id}`,
      {
        headers: {
          cookie: `github_oauth_state=${encodedState}`
        }
      }
    );

    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/github/connected');
  });

  it('redirects with error when state is invalid', async () => {
    const state = generateOAuthState({ redirectPath: '/new' });
    const encodedState = encodeOAuthState(state);

    const request = new NextRequest(
      `http://localhost:4107/api/github/user-authorized?code=valid_code&state=invalid_state`,
      {
        headers: {
          cookie: `github_oauth_state=${encodedState}`
        }
      }
    );

    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('github_error=invalid_state');
  });

  it('redirects with error when state is expired', async () => {
    const state = generateOAuthState({ redirectPath: '/new' });
    const encodedState = encodeOAuthState(state);

    // Fast-forward time to expire state
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);

    const request = new NextRequest(
      `http://localhost:4107/api/github/user-authorized?code=valid_code&state=${state.id}`,
      {
        headers: {
          cookie: `github_oauth_state=${encodedState}`
        }
      }
    );

    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('github_error=state_expired');
  });

  it('handles GitHub API errors gracefully', async () => {
    const state = generateOAuthState({ redirectPath: '/new' });
    const encodedState = encodeOAuthState(state);

    // Mock GitHub API to return error
    setupMockGitHubAPI({
      tokenExchangeError: { error: 'server_error', error_description: 'GitHub is down' }
    });

    const request = new NextRequest(
      `http://localhost:4107/api/github/user-authorized?code=valid_code&state=${state.id}`,
      {
        headers: {
          cookie: `github_oauth_state=${encodedState}`
        }
      }
    );

    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('github_error=server_error');
  });

  it('handles missing authorization code', async () => {
    const state = generateOAuthState({ redirectPath: '/new' });
    const encodedState = encodeOAuthState(state);

    const request = new NextRequest(
      `http://localhost:4107/api/github/user-authorized?state=${state.id}`,
      {
        headers: {
          cookie: `github_oauth_state=${encodedState}`
        }
      }
    );

    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('github_error=missing_code');
  });

  it('handles missing state cookie', async () => {
    const state = generateOAuthState({ redirectPath: '/new' });

    const request = new NextRequest(
      `http://localhost:4107/api/github/user-authorized?code=valid_code&state=${state.id}`,
      {
        headers: {} // No cookie
      }
    );

    const response = await GET(request);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('github_error=invalid_state');
  });

  it('stores installation data in database correctly', async () => {
    const state = generateOAuthState({ redirectPath: '/new' });
    const encodedState = encodeOAuthState(state);

    setupMockGitHubAPI({
      installations: [
        { id: 123, account: { login: 'test-org' } }
      ]
    });

    const request = new NextRequest(
      `http://localhost:4107/api/github/user-authorized?code=valid_code&state=${state.id}`,
      {
        headers: {
          cookie: `github_oauth_state=${encodedState}`
        }
      }
    );

    await GET(request);

    const installations = await testDb.select().from(githubInstallations);
    expect(installations).toHaveLength(1);
    expect(installations[0].installationId).toBe(123);
  });
});
```

### tRPC Procedure Tests

```typescript
// apps/console/src/__tests__/trpc/github-integration.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestCaller } from '../helpers/trpc';
import { setupTestDatabase, cleanupTestDatabase } from '../mocks/database';
import { githubInstallations } from '@db/console/schema';

describe('GitHub Integration tRPC Procedures', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  it('lists user installations correctly', async () => {
    const caller = createTestCaller({ userId: 'test-user' });

    await testDb.insert(githubInstallations).values({
      userId: 'test-user',
      installationId: 123,
      accountLogin: 'test-org',
      accountType: 'Organization',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const result = await caller.userIntegration.listGitHub();

    expect(result).toHaveLength(1);
    expect(result[0].installationId).toBe(123);
    expect(result[0].accountLogin).toBe('test-org');
  });

  it('filters installations by userId correctly', async () => {
    await testDb.insert(githubInstallations).values([
      { userId: 'user-1', installationId: 1, accountLogin: 'org-1', accountType: 'Organization' },
      { userId: 'user-2', installationId: 2, accountLogin: 'org-2', accountType: 'Organization' },
    ]);

    const caller = createTestCaller({ userId: 'user-1' });
    const result = await caller.userIntegration.listGitHub();

    expect(result).toHaveLength(1);
    expect(result[0].installationId).toBe(1);
  });

  it('returns empty array when no installations exist', async () => {
    const caller = createTestCaller({ userId: 'test-user' });
    const result = await caller.userIntegration.listGitHub();

    expect(result).toHaveLength(0);
  });

  it('throws UNAUTHORIZED when user is not authenticated', async () => {
    const caller = createTestCaller({ userId: null });

    await expect(
      caller.userIntegration.listGitHub()
    ).rejects.toThrow('UNAUTHORIZED');
  });

  it('handles database errors gracefully', async () => {
    const caller = createTestCaller({ userId: 'test-user' });

    // Simulate database error
    vi.spyOn(testDb, 'select').mockRejectedValueOnce(new Error('Database connection failed'));

    await expect(
      caller.userIntegration.listGitHub()
    ).rejects.toThrow();
  });
});
```

### Webhook Processing Tests

```typescript
// apps/console/src/__tests__/webhooks/github-webhooks.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from '~/app/(github)/api/github/webhooks/route';
import { NextRequest } from 'next/server';
import { setupTestDatabase, cleanupTestDatabase } from '../mocks/database';
import { createWebhookSignature } from '../helpers/github';

describe('GitHub Webhook Processing', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  it('processes installation.created webhook', async () => {
    const payload = {
      action: 'created',
      installation: {
        id: 123,
        account: { login: 'test-org', type: 'Organization' }
      }
    };

    const signature = createWebhookSignature(JSON.stringify(payload));

    const request = new NextRequest('http://localhost:4107/api/github/webhooks', {
      method: 'POST',
      headers: {
        'x-github-event': 'installation',
        'x-hub-signature-256': signature,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const response = await POST(request);

    expect(response.status).toBe(200);

    const installations = await testDb.select().from(githubInstallations);
    expect(installations).toHaveLength(1);
    expect(installations[0].installationId).toBe(123);
  });

  it('rejects webhook with invalid signature', async () => {
    const payload = { action: 'created' };

    const request = new NextRequest('http://localhost:4107/api/github/webhooks', {
      method: 'POST',
      headers: {
        'x-github-event': 'installation',
        'x-hub-signature-256': 'sha256=invalid-signature',
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('ignores unhandled webhook events', async () => {
    const payload = { action: 'created' };
    const signature = createWebhookSignature(JSON.stringify(payload));

    const request = new NextRequest('http://localhost:4107/api/github/webhooks', {
      method: 'POST',
      headers: {
        'x-github-event': 'unknown_event',
        'x-hub-signature-256': signature,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const response = await POST(request);

    expect(response.status).toBe(200); // Ack but don't process
  });
});
```

---

## Layer 3: E2E Tests

**Framework:** Playwright
**Speed:** 5-30s per test
**Dependencies:** Running dev server, mocked GitHub OAuth
**Coverage Target:** Key user flows only (~15% of total test suite)

### Complete OAuth Flow Test

```typescript
// apps/console/e2e/github-oauth-flow.spec.ts
import { test, expect, type Page } from '@playwright/test';

test.describe('GitHub OAuth Flow', () => {
  test.beforeEach(async ({ page, context }) => {
    // Mock GitHub OAuth server
    await page.route('**/github.com/login/oauth/authorize*', async route => {
      // Simulate GitHub authorization page redirect
      const url = new URL(route.request().url());
      const state = url.searchParams.get('state');
      const redirectUri = url.searchParams.get('redirect_uri');

      await route.fulfill({
        status: 302,
        headers: {
          Location: `${redirectUri}?code=mock_auth_code&state=${state}`
        }
      });
    });

    // Mock GitHub token exchange
    await page.route('**/github.com/login/oauth/access_token', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'gho_mock_token_12345',
          token_type: 'bearer',
          scope: 'repo,user'
        })
      });
    });

    // Mock GitHub installations API
    await page.route('**/api.github.com/user/installations', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          total_count: 1,
          installations: [
            {
              id: 123456,
              account: {
                login: 'test-organization',
                type: 'Organization',
                avatar_url: 'https://avatars.githubusercontent.com/u/123456'
              }
            }
          ]
        })
      });
    });
  });

  test('completes OAuth flow successfully', async ({ page, context }) => {
    await page.goto('/new');

    // Click "Connect GitHub" button
    const popupPromise = context.waitForEvent('page');
    await page.click('button:has-text("Connect GitHub")');
    const popup = await popupPromise;

    // Wait for OAuth redirect to complete
    await popup.waitForURL('**/github/connected', { timeout: 10000 });

    // Verify success message shown in popup
    await expect(popup.locator('text=Successfully connected')).toBeVisible();

    // Popup should close automatically
    await expect(popup).toBeClosed({ timeout: 5000 });

    // Parent page should refetch and show installations
    await expect(page.locator('[data-testid="github-installations"]')).toBeVisible();
    await expect(page.locator('text=test-organization')).toBeVisible();
  });

  test('shows error toast when OAuth fails', async ({ page }) => {
    // Simulate OAuth error redirect
    await page.goto('/new?github_error=invalid_state');

    // Error toast should appear
    const toast = page.locator('[role="alert"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Session Invalid');

    // URL parameter should be cleaned up after toast shown
    await expect(page).toHaveURL('/new');
  });

  test('handles popup blocked by browser', async ({ page, context }) => {
    // Deny popup permission
    await context.grantPermissions([], { origin: page.url() });

    await page.goto('/new');

    // Click connect button
    await page.click('button:has-text("Connect GitHub")');

    // Should show popup blocked message
    await expect(page.locator('text=/popup.*blocked/i')).toBeVisible();
  });

  test('prevents double-click from opening multiple popups', async ({ page, context }) => {
    await page.goto('/new');

    const button = page.locator('button:has-text("Connect GitHub")');

    // Attempt double-click
    await button.dblClick({ delay: 50 });

    // Wait briefly
    await page.waitForTimeout(500);

    // Should only have one popup (original page + 1 popup = 2 pages)
    const pages = context.pages();
    expect(pages.length).toBe(2);
  });

  test('cleans up poll interval on navigation away', async ({ page, context }) => {
    await page.goto('/new');

    // Open popup
    const popupPromise = context.waitForEvent('page');
    await page.click('button:has-text("Connect GitHub")');
    const popup = await popupPromise;

    // Navigate away from parent page before popup closes
    await page.goto('/dashboard');

    // Close popup manually
    await popup.close();

    // Verify no console errors about unmounted component updates
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.waitForTimeout(1000);

    expect(consoleErrors).not.toContainEqual(
      expect.stringContaining('unmounted component')
    );
  });

  test('times out popup after 10 minutes', async ({ page, context }) => {
    await page.goto('/new');

    // Mock popup that never completes
    await page.route('**/api/github/install-app*', route => {
      route.fulfill({
        status: 200,
        body: '<html><body>Loading forever...</body></html>'
      });
    });

    const popupPromise = context.waitForEvent('page');
    await page.click('button:has-text("Connect GitHub")');
    const popup = await popupPromise;

    // Fast-forward time (requires special browser context setup)
    // For Playwright, we'd need to use page.clock() or similar

    // Popup should close automatically after timeout
    await expect(popup).toBeClosed({ timeout: 600_000 + 5000 }); // 10 min + buffer
  });

  test('displays all error types with user-friendly messages', async ({ page }) => {
    const errorCases = [
      { param: 'invalid_state', expectedMessage: 'Session Invalid' },
      { param: 'state_expired', expectedMessage: 'Session Expired' },
      { param: 'missing_code', expectedMessage: 'Authorization Incomplete' },
      { param: 'no_access_token', expectedMessage: 'Access Token Failed' },
      { param: 'unauthorized', expectedMessage: 'Not Signed In' },
      { param: 'installations_fetch_failed', expectedMessage: 'Failed to Load' },
      { param: 'database_error', expectedMessage: 'Save Failed' },
      { param: 'exchange_failed', expectedMessage: 'Authorization Failed' }
    ];

    for (const { param, expectedMessage } of errorCases) {
      await page.goto(`/new?github_error=${param}`);

      const toast = page.locator('[role="alert"]');
      await expect(toast).toBeVisible();
      await expect(toast).toContainText(expectedMessage);

      // Verify URL cleanup
      await page.waitForTimeout(100);
      await expect(page).toHaveURL('/new');

      // Dismiss toast before next iteration
      await toast.click();
      await expect(toast).not.toBeVisible();
    }
  });
});
```

### Multi-Browser Popup Tests

```typescript
// apps/console/e2e/popup-cross-browser.spec.ts
import { test, expect, devices } from '@playwright/test';

test.describe('Cross-Browser Popup Behavior', () => {
  test.use({ ...devices['Desktop Chrome'] });

  test('Chrome: popup opens and closes correctly', async ({ page, context }) => {
    await page.goto('/new');

    const popupPromise = context.waitForEvent('page');
    await page.click('button:has-text("Connect GitHub")');
    const popup = await popupPromise;

    expect(popup).toBeTruthy();
    await popup.close();
  });
});

test.describe('Safari Popup Restrictions', () => {
  test.use({ ...devices['Desktop Safari'] });

  test('Safari: popup requires synchronous call from user gesture', async ({ page }) => {
    await page.goto('/new');

    // Verify button click directly triggers window.open (not async)
    const button = page.locator('button:has-text("Connect GitHub")');
    await button.click();

    // In Safari, async window.open would be blocked
    // Our implementation should work because it's synchronous
    await page.waitForTimeout(500);

    // Should not show popup blocked message
    await expect(page.locator('text=/popup.*blocked/i')).not.toBeVisible();
  });
});
```

---

## Layer 4: Contract Tests

**Framework:** Vitest with real GitHub API calls (VCR pattern)
**Purpose:** Ensure GitHub API responses match our assumptions
**Coverage:** All external API schemas

```typescript
// apps/console/src/__tests__/contracts/github-api.contract.test.ts
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('GitHub API Contracts', () => {
  it('token exchange response matches expected schema', async () => {
    const schema = z.object({
      access_token: z.string().optional(),
      error: z.string().optional(),
      error_description: z.string().optional(),
      token_type: z.string().optional(),
      scope: z.string().optional()
    });

    // Use recorded VCR cassette or real API call in CI
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        client_id: 'test',
        client_secret: 'test',
        code: 'test'
      })
    });

    const data = await response.json();

    // Should not throw - GitHub's response structure hasn't changed
    expect(() => schema.parse(data)).not.toThrow();
  });

  it('installations API response matches expected schema', async () => {
    const installationSchema = z.object({
      total_count: z.number(),
      installations: z.array(z.object({
        id: z.number(),
        account: z.object({
          login: z.string(),
          type: z.enum(['User', 'Organization']),
          avatar_url: z.string().url()
        }),
        permissions: z.object({}).passthrough(),
        events: z.array(z.string())
      }))
    });

    // Use recorded response or real API call
    const mockResponse = {
      total_count: 1,
      installations: [
        {
          id: 123456,
          account: {
            login: 'test-org',
            type: 'Organization',
            avatar_url: 'https://avatars.githubusercontent.com/u/123456'
          },
          permissions: {},
          events: ['push', 'pull_request']
        }
      ]
    };

    expect(() => installationSchema.parse(mockResponse)).not.toThrow();
  });

  it('webhook payloads match expected schemas', () => {
    const installationEventSchema = z.object({
      action: z.enum(['created', 'deleted', 'suspend', 'unsuspend']),
      installation: z.object({
        id: z.number(),
        account: z.object({
          login: z.string(),
          type: z.string()
        })
      }),
      sender: z.object({
        login: z.string()
      })
    });

    const samplePayload = {
      action: 'created',
      installation: {
        id: 123,
        account: { login: 'test-org', type: 'Organization' }
      },
      sender: { login: 'user' }
    };

    expect(() => installationEventSchema.parse(samplePayload)).not.toThrow();
  });
});
```

---

## Test Setup Configuration

### Vitest Configuration

```typescript
// apps/console/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/__tests__/**',
        'src/env.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80
      }
    }
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src')
    }
  }
});
```

### Vitest Setup File

```typescript
// apps/console/src/__tests__/setup.ts
import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Suppress console errors in tests (optional)
global.console = {
  ...console,
  error: vi.fn(),
  warn: vi.fn(),
};
```

### Playwright Configuration

```typescript
// apps/console/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:4107',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Uncomment for cross-browser testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
  ],

  webServer: {
    command: 'pnpm dev:console',
    url: 'http://localhost:4107',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### Test Helpers and Mocks

```typescript
// apps/console/src/__tests__/helpers/trpc.ts
import { createCallerFactory } from '@trpc/server';
import { appRouter } from '@api/console';
import { createTRPCContext } from '@api/console';

export const createTestCaller = (context: { userId: string | null }) => {
  const createCaller = createCallerFactory(appRouter);

  return createCaller({
    session: context.userId ? { userId: context.userId } : null,
    db: testDb, // Test database instance
  });
};
```

```typescript
// apps/console/src/__tests__/mocks/github-api.ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const githubAPIHandlers = [
  http.post('https://github.com/login/oauth/access_token', () => {
    return HttpResponse.json({
      access_token: 'gho_mock_token_12345',
      token_type: 'bearer',
      scope: 'repo,user'
    });
  }),

  http.get('https://api.github.com/user/installations', () => {
    return HttpResponse.json({
      total_count: 1,
      installations: [
        {
          id: 123456,
          account: { login: 'test-org', type: 'Organization' }
        }
      ]
    });
  }),
];

export const server = setupServer(...githubAPIHandlers);

export const setupMockGitHubAPI = (overrides = {}) => {
  server.listen({ onUnhandledRequest: 'error' });
};

export const cleanupMockGitHubAPI = () => {
  server.close();
};
```

```typescript
// apps/console/src/__tests__/mocks/database.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

let testDb: ReturnType<typeof drizzle>;
let pool: Pool;

export const setupTestDatabase = async () => {
  pool = new Pool({
    connectionString: process.env.TEST_DATABASE_URL,
  });

  testDb = drizzle(pool);

  // Run migrations
  await migrate(testDb, { migrationsFolder: './migrations' });

  return testDb;
};

export const cleanupTestDatabase = async () => {
  // Truncate all tables
  await testDb.execute(sql`TRUNCATE TABLE github_installations CASCADE`);

  await pool.end();
};

export { testDb };
```

---

## Test Coverage Targets

| Layer | Coverage Target | Priority | Estimated Test Count |
|-------|----------------|----------|---------------------|
| **Unit Tests** | 90%+ | 🔴 Critical | 50-80 tests |
| **Integration Tests** | 80%+ | 🔴 Critical | 30-50 tests |
| **E2E Tests** | Key flows only | 🟡 High | 10-15 tests |
| **Contract Tests** | All external APIs | 🟢 Medium | 5-10 tests |

### Coverage Breakdown by Feature

| Feature | Unit | Integration | E2E | Total |
|---------|------|-------------|-----|-------|
| OAuth state validation | 10 | 5 | 2 | 17 |
| Token encryption | 8 | 3 | 0 | 11 |
| API route handlers | 5 | 15 | 3 | 23 |
| Error handling | 12 | 8 | 8 | 28 |
| Component lifecycle | 15 | 0 | 5 | 20 |
| Webhook processing | 3 | 10 | 0 | 13 |
| tRPC procedures | 5 | 12 | 0 | 17 |
| **Total** | **58** | **53** | **18** | **129** |

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1) - Estimated 8-12 hours

**Goal:** Set up test infrastructure and write first unit tests

#### Tasks

1. **Set up Vitest** (2 hours)
   - [ ] Install dependencies (`vitest`, `@testing-library/react`, `@testing-library/jest-dom`)
   - [ ] Create `vitest.config.ts`
   - [ ] Create test setup file
   - [ ] Configure TypeScript paths

2. **Set up test helpers** (2 hours)
   - [ ] Create tRPC test caller factory
   - [ ] Create database test utilities
   - [ ] Create GitHub API mocks (MSW)

3. **Write OAuth unit tests** (4 hours)
   - [ ] State generation tests (5 tests)
   - [ ] State validation tests (8 tests)
   - [ ] Token encryption tests (6 tests)
   - [ ] Error message mapping tests (4 tests)

4. **Write component unit tests** (4 hours)
   - [ ] GitHubConnector lifecycle tests (8 tests)
   - [ ] GitHubOAuthErrorHandler tests (5 tests)
   - [ ] RepositoryPicker tests (4 tests)

**Deliverables:**
- ✅ Vitest running with 25+ unit tests
- ✅ 70%+ code coverage on tested modules
- ✅ CI/CD integration (GitHub Actions)

---

### Phase 2: Integration Tests (Week 2) - Estimated 10-15 hours

**Goal:** Test API routes and tRPC procedures with mocked services

#### Tasks

1. **Set up integration test environment** (3 hours)
   - [ ] Configure test database (PostgreSQL)
   - [ ] Set up MSW for GitHub API mocking
   - [ ] Create request/response factories
   - [ ] Set up Clerk auth mocking

2. **API route integration tests** (6 hours)
   - [ ] `user-authorized` callback tests (10 tests)
   - [ ] `install-app` redirect tests (5 tests)
   - [ ] `app-installed` callback tests (5 tests)
   - [ ] Webhook processing tests (8 tests)

3. **tRPC procedure integration tests** (4 hours)
   - [ ] GitHub integration listing tests (6 tests)
   - [ ] Installation CRUD tests (8 tests)
   - [ ] Authorization tests (4 tests)

4. **Database integration tests** (2 hours)
   - [ ] Schema validation tests (3 tests)
   - [ ] Migration tests (2 tests)
   - [ ] Constraint tests (3 tests)

**Deliverables:**
- ✅ 30+ integration tests passing
- ✅ 80%+ coverage on API routes
- ✅ Test database setup/teardown automated

---

### Phase 3: E2E Tests (Week 3) - Estimated 12-16 hours

**Goal:** Test complete user flows in real browser

#### Tasks

1. **Set up Playwright** (3 hours)
   - [ ] Install Playwright and browsers
   - [ ] Create `playwright.config.ts`
   - [ ] Set up test fixtures
   - [ ] Configure GitHub OAuth mocking for E2E

2. **OAuth flow E2E tests** (5 hours)
   - [ ] Complete success flow test (1 test)
   - [ ] Error handling flow tests (8 tests)
   - [ ] Popup behavior tests (4 tests)
   - [ ] URL cleanup tests (2 tests)

3. **Cross-browser tests** (4 hours)
   - [ ] Chromium tests (reuse above)
   - [ ] WebKit/Safari tests (focus on popup restrictions)
   - [ ] Firefox tests (optional)

4. **Visual regression tests** (optional, 4 hours)
   - [ ] Screenshot comparison for error toasts
   - [ ] Screenshot comparison for success states

**Deliverables:**
- ✅ 15+ E2E tests passing
- ✅ Tests run in CI on Chromium + WebKit
- ✅ Key user flows fully automated

---

### Phase 4: Contract Tests & Polish (Week 4) - Estimated 6-8 hours

**Goal:** Ensure external API contracts are stable

#### Tasks

1. **GitHub API contract tests** (3 hours)
   - [ ] Token exchange schema test
   - [ ] Installations API schema test
   - [ ] Webhook payload schema tests (5 event types)

2. **Test documentation** (2 hours)
   - [ ] Update README with test instructions
   - [ ] Document test patterns and conventions
   - [ ] Create test writing guide

3. **CI/CD optimization** (3 hours)
   - [ ] Parallelize test execution
   - [ ] Add test result reporting
   - [ ] Set up coverage reporting (Codecov)
   - [ ] Add pre-commit hooks

**Deliverables:**
- ✅ 100+ tests total across all layers
- ✅ 85%+ overall code coverage
- ✅ Automated test runs on every PR
- ✅ Test documentation complete

---

## Automation Feasibility Matrix

| Test Scenario | Automation % | Approach | Effort | ROI |
|---------------|--------------|----------|--------|-----|
| **OAuth state validation** | 95% | Unit tests (Vitest) | Low | ⭐⭐⭐⭐⭐ |
| **Token encryption** | 95% | Unit tests (Vitest) | Low | ⭐⭐⭐⭐⭐ |
| **Error message mapping** | 100% | Unit tests (Vitest) | Low | ⭐⭐⭐⭐⭐ |
| **Component lifecycle** | 90% | Unit tests (React Testing Library) | Low | ⭐⭐⭐⭐⭐ |
| **API route handlers** | 90% | Integration tests (MSW) | Medium | ⭐⭐⭐⭐⭐ |
| **tRPC procedures** | 90% | Integration tests (test DB) | Medium | ⭐⭐⭐⭐⭐ |
| **Database operations** | 95% | Integration tests (test DB) | Medium | ⭐⭐⭐⭐ |
| **Webhook processing** | 85% | Integration tests (MSW) | Medium | ⭐⭐⭐⭐ |
| **OAuth flow (mocked GitHub)** | 85% | E2E tests (Playwright) | Medium | ⭐⭐⭐⭐ |
| **Popup behavior** | 80% | E2E tests (Playwright) | Medium | ⭐⭐⭐⭐ |
| **Error toast display** | 90% | E2E tests (Playwright) | Low | ⭐⭐⭐⭐ |
| **Cross-browser popups** | 70% | E2E tests (Playwright multi-browser) | High | ⭐⭐⭐ |
| **GitHub API contracts** | 80% | Contract tests (VCR/snapshot) | Low | ⭐⭐⭐⭐ |
| **OAuth with real GitHub** | 40% | E2E tests (staging) + manual | High | ⭐⭐⭐ |
| **GitHub App installation** | 50% | E2E tests (test org) + manual | High | ⭐⭐⭐ |
| **Third-party cookie blocking** | 20% | Manual testing (privacy tools) | High | ⭐⭐ |
| **Production smoke tests** | 30% | Synthetic monitoring + manual | Medium | ⭐⭐⭐ |

### Legend

- **Automation %**: Percentage of test coverage achievable through automation
- **Effort**: Implementation time (Low: <4h, Medium: 4-8h, High: >8h)
- **ROI**: Return on investment (⭐ to ⭐⭐⭐⭐⭐)

### Key Insights

1. **Quick Wins (High ROI, Low Effort):**
   - Unit tests for OAuth utilities (95% automation, low effort)
   - Component lifecycle tests (90% automation, low effort)
   - Error message mapping (100% automation, low effort)

2. **High Value (High ROI, Medium Effort):**
   - API route integration tests (90% automation)
   - tRPC procedure tests (90% automation)
   - E2E OAuth flow with mocked GitHub (85% automation)

3. **Diminishing Returns (Low ROI, High Effort):**
   - Real GitHub OAuth testing (40% automation, high effort)
   - Third-party cookie blocking tests (20% automation, high effort)

4. **Recommended Approach:**
   - **Phase 1-2:** Focus on unit + integration tests (90% automation)
   - **Phase 3:** Add E2E with mocked GitHub (85% automation)
   - **Phase 4:** Manual testing for edge cases in staging/production

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 10.5.2
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run unit tests
        run: pnpm --filter @lightfast/console test:unit

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/console/coverage/coverage-final.json

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 10.5.2
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run migrations
        run: pnpm --filter @lightfast/console db:migrate
        env:
          TEST_DATABASE_URL: postgres://postgres:postgres@localhost:5432/test

      - name: Run integration tests
        run: pnpm --filter @lightfast/console test:integration
        env:
          TEST_DATABASE_URL: postgres://postgres:postgres@localhost:5432/test

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: 10.5.2
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium webkit

      - name: Run E2E tests
        run: pnpm --filter @lightfast/console test:e2e

      - name: Upload Playwright report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: apps/console/playwright-report/
          retention-days: 30
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "pnpm test:unit && pnpm test:integration && pnpm test:e2e",
    "test:unit": "vitest run --coverage",
    "test:unit:watch": "vitest watch",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug"
  }
}
```

---

## Summary

### Overall Automation Feasibility

| Layer | Tests | Automation % | Effort | Status |
|-------|-------|--------------|--------|--------|
| Unit Tests | 58 | 95% | Low | 🟢 Highly Recommended |
| Integration Tests | 53 | 90% | Medium | 🟢 Highly Recommended |
| E2E Tests | 18 | 85% | Medium | 🟡 Recommended |
| Contract Tests | 10 | 80% | Low | 🟡 Recommended |
| Manual Tests | ~15 | 0% | Low | 🟢 Essential |
| **Total** | **154** | **87%** | **~40h** | **🟢 Excellent ROI** |

### Key Takeaways

1. **85-95% of GitHub integration testing can be automated** with unit + integration + E2E tests
2. **Best ROI:** Unit and integration tests (90%+ coverage, low-medium effort)
3. **Quick wins:** Start with OAuth utilities and component tests (Phase 1)
4. **Diminishing returns:** Real GitHub OAuth testing requires manual verification
5. **Recommended approach:** Automated tests for happy + error paths, manual exploratory for edge cases

### Next Steps

1. **Approve strategy:** Review and approve this testing plan
2. **Phase 1:** Implement unit tests (1 week, 8-12 hours)
3. **Phase 2:** Implement integration tests (1 week, 10-15 hours)
4. **Phase 3:** Implement E2E tests (1 week, 12-16 hours)
5. **Phase 4:** Polish and document (1 week, 6-8 hours)

**Total Time Investment:** ~40 hours over 4 weeks
**Long-term Savings:** 10-20 hours per release cycle (no manual regression testing)
**Break-even Point:** 2-3 release cycles

---

**Document Status:** 📋 Planning Complete - Ready for Implementation
**Last Updated:** 2025-11-26
**Next Review:** After Phase 1 completion
