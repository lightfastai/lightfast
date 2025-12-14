/**
 * Security-focused Test Scenario
 *
 * Contains events that should trigger high significance scores
 * and extract security-related entities.
 */

import type { SourceEvent } from "@repo/console-types";
import { githubPR, githubIssue, githubPush } from "../events";

/**
 * Security-focused test scenario
 * Contains events that should trigger high significance scores
 * and extract security-related entities
 */
export const securityScenario = (): SourceEvent[] => [
  githubPR({
    repo: "test/repo",
    prNumber: 101,
    title: "feat(auth): Implement OAuth2 PKCE flow for secure authentication",
    body: `## Summary
Implements PKCE (Proof Key for Code Exchange) extension to OAuth2 flow.
This prevents authorization code interception attacks.

## Changes
- Added PKCE challenge generation in \`src/lib/auth/pkce.ts\`
- Updated OAuth callback to verify code_verifier
- Added @security-team as reviewer for audit

## Security Impact
- Mitigates CVE-2019-XXXX class vulnerabilities
- Required for mobile clients per IETF RFC 7636

Fixes #45`,
    action: "merged",
    author: "alice",
    labels: ["security", "auth"],
    linkedIssues: ["#45"],
    reviewers: ["security-team"],
    daysAgo: 2,
  }),

  githubIssue({
    repo: "test/repo",
    issueNumber: 102,
    title: "Critical: API keys exposed in client bundle",
    body: `## Problem
Found API_KEY and JWT_SECRET exposed in the production bundle.

## Steps to Reproduce
1. Open browser DevTools
2. Search for "API_KEY" in Sources

## Impact
Attackers could impersonate the server or forge JWTs.

## Suggested Fix
Move secrets to server-side environment variables.
Reference: src/config/keys.ts:15`,
    action: "opened",
    author: "bob",
    labels: ["security", "critical", "bug"],
    daysAgo: 1,
  }),

  githubPush({
    repo: "test/repo",
    branch: "main",
    commitMessage: `fix(security): Rotate compromised credentials

- Regenerated DATABASE_URL with new password
- Updated Redis connection string
- Invalidated all existing JWT tokens

BREAKING: All users will need to re-authenticate`,
    author: "charlie",
    filesChanged: 3,
    daysAgo: 0,
  }),
];
