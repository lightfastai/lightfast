// Type imports - using simplified types to avoid complex webhook type issues
type PushEvent = any;
type PullRequestEvent = any;
type SentryErrorWebhook = any;

/**
 * Corpus templates for deterministic test data generation
 * These are simplified templates that get expanded into full webhook payloads
 */

interface PushTemplate {
  id: string;
  repo: string;
  author: string;
  message: string;
  files: string[];
  timestamp: string;
  branch: string;
}

interface PullRequestTemplate {
  id: string;
  repo: string;
  author: string;
  title: string;
  body: string;
  labels: string[];
  timestamp: string;
}

interface SentryErrorTemplate {
  id: string;
  project: string;
  message: string;
  level: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

export const CORPUS_TEMPLATES = {
  github_push: [
    {
      id: "checkout-service-fix",
      repo: "acme/checkout-service",
      author: "sarah@acme.com",
      message: "fix: resolve memory leak in payment processor",
      files: ["src/payments/processor.ts", "src/payments/queue.ts"],
      timestamp: "2025-12-01T10:30:00Z",
      branch: "main",
    },
    {
      id: "auth-module-refactor",
      repo: "acme/platform",
      author: "alex@acme.com",
      message: "refactor: migrate auth to OAuth 2.1",
      files: ["src/auth/oauth.ts", "src/auth/tokens.ts"],
      timestamp: "2025-12-03T14:00:00Z",
      branch: "feat/oauth-upgrade",
    },
    {
      id: "api-rate-limiting",
      repo: "acme/api-gateway",
      author: "jamie@acme.com",
      message: "feat: add rate limiting middleware",
      files: ["src/middleware/rate-limit.ts", "src/config/limits.ts"],
      timestamp: "2025-12-05T09:15:00Z",
      branch: "main",
    },
    {
      id: "database-migration-rollback",
      repo: "acme/backend",
      author: "taylor@acme.com",
      message: "fix: rollback failed migration for user_sessions table",
      files: ["migrations/20251201_user_sessions_rollback.sql"],
      timestamp: "2025-12-01T16:45:00Z",
      branch: "hotfix/session-migration",
    },
    {
      id: "monitoring-dashboard",
      repo: "acme/ops",
      author: "morgan@acme.com",
      message: "feat: add Grafana dashboard for checkout service",
      files: ["dashboards/checkout-metrics.json", "alerts/checkout-alerts.yaml"],
      timestamp: "2025-12-04T11:20:00Z",
      branch: "main",
    },
    {
      id: "cache-invalidation-fix",
      repo: "acme/cache-service",
      author: "riley@acme.com",
      message: "fix: correct Redis cache invalidation logic",
      files: ["src/cache/invalidate.ts", "src/cache/patterns.ts"],
      timestamp: "2025-12-02T13:30:00Z",
      branch: "main",
    },
    {
      id: "ci-pipeline-optimization",
      repo: "acme/platform",
      author: "casey@acme.com",
      message: "perf: optimize CI pipeline build times",
      files: [".github/workflows/ci.yml", "scripts/build-parallel.sh"],
      timestamp: "2025-12-06T08:00:00Z",
      branch: "main",
    },
    {
      id: "frontend-button-styling",
      repo: "acme/web-app",
      author: "drew@acme.com",
      message: "style: update primary button colors",
      files: ["src/components/Button.tsx", "src/styles/colors.ts"],
      timestamp: "2025-12-07T15:30:00Z",
      branch: "design/button-refresh",
    },
    {
      id: "api-documentation-update",
      repo: "acme/api-docs",
      author: "avery@acme.com",
      message: "docs: update API authentication guide",
      files: ["docs/api/authentication.md", "docs/api/quickstart.md"],
      timestamp: "2025-12-08T10:00:00Z",
      branch: "main",
    },
    {
      id: "security-patch-dependencies",
      repo: "acme/platform",
      author: "jordan@acme.com",
      message: "sec: update dependencies with security vulnerabilities",
      files: ["package.json", "pnpm-lock.yaml"],
      timestamp: "2025-12-09T09:00:00Z",
      branch: "security/dep-updates",
    },
  ] as PushTemplate[],

  github_pr: [
    {
      id: "redis-outage-postmortem",
      repo: "acme/infrastructure",
      author: "jamie@acme.com",
      title: "Post-mortem: Redis outage on Dec 1st",
      body: "Root cause: connection pool exhaustion due to increased traffic.\n\nImpact: Checkout service degraded for 45 minutes.\n\nResolution: Increased connection pool size from 50 to 200.\n\nPrevention: Added connection pool monitoring and alerts.",
      labels: ["incident", "infrastructure"],
      timestamp: "2025-12-02T09:00:00Z",
    },
    {
      id: "feature-request-bulk-export",
      repo: "acme/platform",
      author: "casey@acme.com",
      title: "Feature: Add bulk data export API",
      body: "Implement REST endpoint for exporting large datasets.\n\nUse case: Customers need to export transaction history for compliance.\n\nProposed endpoint: POST /api/v2/export with streaming response.",
      labels: ["feature", "api"],
      timestamp: "2025-12-03T14:30:00Z",
    },
    {
      id: "bug-report-payment-timeout",
      repo: "acme/checkout-service",
      author: "morgan@acme.com",
      title: "Bug: Payment gateway timeout on large orders",
      body: "Description: Orders over $1000 timeout when processing payment.\n\nSteps to reproduce:\n1. Add items totaling >$1000 to cart\n2. Proceed to checkout\n3. Submit payment\n\nExpected: Payment processed within 5 seconds\nActual: Timeout after 30 seconds\n\nAffects: ~5% of premium customers",
      labels: ["bug", "payments", "priority:high"],
      timestamp: "2025-12-01T11:00:00Z",
    },
    {
      id: "refactor-auth-module",
      repo: "acme/platform",
      author: "alex@acme.com",
      title: "Refactor: Migrate authentication to OAuth 2.1",
      body: "Modernize auth flow to OAuth 2.1 standard.\n\nChanges:\n- Replace custom JWT flow with OAuth 2.1\n- Add PKCE support for mobile clients\n- Implement token refresh rotation\n\nBreaking changes: None (backward compatible)\n\nTesting: Full e2e auth flow tested",
      labels: ["refactor", "security"],
      timestamp: "2025-12-03T16:00:00Z",
    },
    {
      id: "performance-database-queries",
      repo: "acme/backend",
      author: "taylor@acme.com",
      title: "Performance: Optimize slow dashboard queries",
      body: "Dashboard loading takes 15 seconds due to unoptimized queries.\n\nFixes:\n- Added indexes on user_id and created_at columns\n- Implemented query result caching (5 min TTL)\n- Reduced N+1 queries in dashboard API\n\nBefore: 15s load time\nAfter: 1.2s load time\n\nTested with production data sample (1M rows)",
      labels: ["performance", "database"],
      timestamp: "2025-12-04T10:30:00Z",
    },
    {
      id: "docs-api-rate-limits",
      repo: "acme/api-docs",
      author: "avery@acme.com",
      title: "Docs: Document new rate limiting behavior",
      body: "Added comprehensive documentation for new rate limiting system.\n\nCoverage:\n- Rate limit headers\n- Tier-based limits (free/pro/enterprise)\n- Retry-After header usage\n- Best practices for handling 429 responses",
      labels: ["documentation"],
      timestamp: "2025-12-05T14:00:00Z",
    },
    {
      id: "feature-webhook-retry",
      repo: "acme/webhooks",
      author: "riley@acme.com",
      title: "Feature: Automatic webhook retry with exponential backoff",
      body: "Implement retry logic for failed webhook deliveries.\n\nRetry schedule:\n- Attempt 1: Immediate\n- Attempt 2: 5 minutes\n- Attempt 3: 15 minutes\n- Attempt 4: 1 hour\n- Attempt 5: 6 hours\n\nGives up after 5 attempts and logs to dead letter queue.",
      labels: ["feature", "reliability"],
      timestamp: "2025-12-06T09:45:00Z",
    },
    {
      id: "security-audit-findings",
      repo: "acme/security",
      author: "jordan@acme.com",
      title: "Security: Address Q4 audit findings",
      body: "Implemented fixes for security audit findings.\n\nFixed issues:\n1. SQL injection vulnerability in search endpoint (CRITICAL)\n2. XSS risk in user profile display (HIGH)\n3. Missing CSRF tokens on admin endpoints (MEDIUM)\n4. Weak password policy (LOW)\n\nAll findings verified fixed by external auditor.",
      labels: ["security", "audit"],
      timestamp: "2025-12-09T11:00:00Z",
    },
  ] as PullRequestTemplate[],

  sentry_error: [
    {
      id: "database-timeout",
      project: "checkout-service",
      message: "Database query timeout in payment flow",
      level: "error",
      count: 147,
      firstSeen: "2025-12-01T10:00:00Z",
      lastSeen: "2025-12-01T11:30:00Z",
    },
    {
      id: "redis-connection-error",
      project: "cache-service",
      message: "Redis connection pool exhausted",
      level: "error",
      count: 89,
      firstSeen: "2025-12-01T10:15:00Z",
      lastSeen: "2025-12-01T10:45:00Z",
    },
    {
      id: "null-pointer-cart",
      project: "checkout-service",
      message: "NullPointerException in cart calculation",
      level: "error",
      count: 23,
      firstSeen: "2025-12-02T14:30:00Z",
      lastSeen: "2025-12-02T15:00:00Z",
    },
    {
      id: "api-gateway-timeout",
      project: "api-gateway",
      message: "Request timeout to upstream service",
      level: "warning",
      count: 456,
      firstSeen: "2025-12-03T08:00:00Z",
      lastSeen: "2025-12-03T09:30:00Z",
    },
    {
      id: "auth-token-invalid",
      project: "platform",
      message: "Invalid JWT token signature",
      level: "warning",
      count: 78,
      firstSeen: "2025-12-04T12:00:00Z",
      lastSeen: "2025-12-04T13:00:00Z",
    },
    {
      id: "payment-gateway-500",
      project: "checkout-service",
      message: "Payment gateway returned 500 Internal Server Error",
      level: "error",
      count: 34,
      firstSeen: "2025-12-05T16:20:00Z",
      lastSeen: "2025-12-05T16:50:00Z",
    },
    {
      id: "memory-leak-detected",
      project: "backend",
      message: "Memory usage exceeds 90% threshold",
      level: "critical",
      count: 12,
      firstSeen: "2025-12-06T03:00:00Z",
      lastSeen: "2025-12-06T04:00:00Z",
    },
    {
      id: "rate-limit-exceeded",
      project: "api-gateway",
      message: "Rate limit exceeded for user API requests",
      level: "info",
      count: 234,
      firstSeen: "2025-12-07T10:00:00Z",
      lastSeen: "2025-12-07T11:00:00Z",
    },
  ] as SentryErrorTemplate[],
} as const;

/**
 * Generate full webhook payloads from templates
 */
export function generateCorpus(): {
  pushes: PushEvent[];
  prs: PullRequestEvent[];
  errors: SentryErrorWebhook[];
} {
  const pushes: PushEvent[] = CORPUS_TEMPLATES.github_push.map((template) =>
    generatePushEvent(template)
  );

  const prs: PullRequestEvent[] = CORPUS_TEMPLATES.github_pr.map((template) =>
    generatePullRequestEvent(template)
  );

  const errors: SentryErrorWebhook[] = CORPUS_TEMPLATES.sentry_error.map(
    (template) => generateSentryError(template)
  );

  return { pushes, prs, errors };
}

/**
 * Generate full GitHub push event from template
 */
function generatePushEvent(template: PushTemplate): PushEvent {
  const [owner, repoName] = template.repo.split("/");
  const authorUsername = template.author.split("@")[0];

  return {
    ref: `refs/heads/${template.branch}`,
    before: "0000000000000000000000000000000000000000",
    after: template.id,
    created: false,
    deleted: false,
    forced: false,
    base_ref: null,
    compare: `https://github.com/${template.repo}/compare/...${template.id}`,
    commits: [
      {
        id: template.id,
        tree_id: `tree_${template.id}`,
        distinct: true,
        message: template.message,
        timestamp: template.timestamp,
        url: `https://github.com/${template.repo}/commit/${template.id}`,
        author: {
          name: authorUsername,
          email: template.author,
          username: authorUsername,
        },
        committer: {
          name: authorUsername,
          email: template.author,
          username: authorUsername,
        },
        added: template.files.filter((f) => f.includes("new")),
        removed: [],
        modified: template.files.filter((f) => !f.includes("new")),
      },
    ],
    head_commit: {
      id: template.id,
      tree_id: `tree_${template.id}`,
      distinct: true,
      message: template.message,
      timestamp: template.timestamp,
      url: `https://github.com/${template.repo}/commit/${template.id}`,
      author: {
        name: authorUsername,
        email: template.author,
        username: authorUsername,
      },
      committer: {
        name: authorUsername,
        email: template.author,
        username: authorUsername,
      },
      added: template.files.filter((f) => f.includes("new")),
      removed: [],
      modified: template.files.filter((f) => !f.includes("new")),
    },
    repository: {
      id: Math.floor(Math.random() * 1000000),
      node_id: `R_${template.id}`,
      name: repoName,
      full_name: template.repo,
      private: false,
      owner: {
        name: owner,
        email: null,
        login: owner,
        id: Math.floor(Math.random() * 100000),
        node_id: `U_${owner}`,
        avatar_url: `https://avatars.githubusercontent.com/u/${owner}`,
        gravatar_id: null,
        url: `https://api.github.com/users/${owner}`,
        html_url: `https://github.com/${owner}`,
        followers_url: `https://api.github.com/users/${owner}/followers`,
        following_url: `https://api.github.com/users/${owner}/following{/other_user}`,
        gists_url: `https://api.github.com/users/${owner}/gists{/gist_id}`,
        starred_url: `https://api.github.com/users/${owner}/starred{/owner}{/repo}`,
        subscriptions_url: `https://api.github.com/users/${owner}/subscriptions`,
        organizations_url: `https://api.github.com/users/${owner}/orgs`,
        repos_url: `https://api.github.com/users/${owner}/repos`,
        events_url: `https://api.github.com/users/${owner}/events{/privacy}`,
        received_events_url: `https://api.github.com/users/${owner}/received_events`,
        type: "Organization",
        site_admin: false,
      },
      html_url: `https://github.com/${template.repo}`,
      description: `Repository for ${repoName}`,
      fork: false,
      url: `https://api.github.com/repos/${template.repo}`,
      // Required fields for PushEvent
      archive_url: "",
      assignees_url: "",
      blobs_url: "",
      branches_url: "",
      collaborators_url: "",
      comments_url: "",
      commits_url: "",
      compare_url: "",
      contents_url: "",
      contributors_url: "",
      deployments_url: "",
      downloads_url: "",
      events_url: "",
      forks_url: "",
      git_commits_url: "",
      git_refs_url: "",
      git_tags_url: "",
      hooks_url: "",
      issue_comment_url: "",
      issue_events_url: "",
      issues_url: "",
      keys_url: "",
      labels_url: "",
      languages_url: "",
      merges_url: "",
      milestones_url: "",
      notifications_url: "",
      pulls_url: "",
      releases_url: "",
      stargazers_url: "",
      statuses_url: "",
      subscribers_url: "",
      subscription_url: "",
      tags_url: "",
      teams_url: "",
      trees_url: "",
      created_at: 1234567890,
      updated_at: template.timestamp,
      pushed_at: 1234567890,
      git_url: "",
      ssh_url: "",
      clone_url: "",
      svn_url: "",
      homepage: null,
      size: 1000,
      stargazers_count: 10,
      watchers_count: 10,
      language: "TypeScript",
      has_issues: true,
      has_projects: true,
      has_downloads: true,
      has_wiki: true,
      has_pages: false,
      has_discussions: false,
      forks_count: 2,
      mirror_url: null,
      archived: false,
      disabled: false,
      open_issues_count: 5,
      license: null,
      allow_forking: true,
      is_template: false,
      web_commit_signoff_required: false,
      topics: [],
      visibility: "public",
      forks: 2,
      open_issues: 5,
      watchers: 10,
      default_branch: "main",
      stargazers: 10,
      master_branch: "main",
    },
    pusher: {
      name: authorUsername,
      email: template.author,
    },
    sender: {
      login: authorUsername,
      id: Math.floor(Math.random() * 100000),
      node_id: `U_${authorUsername}`,
      avatar_url: `https://avatars.githubusercontent.com/u/${authorUsername}`,
      gravatar_id: null,
      url: `https://api.github.com/users/${authorUsername}`,
      html_url: `https://github.com/${authorUsername}`,
      followers_url: `https://api.github.com/users/${authorUsername}/followers`,
      following_url: `https://api.github.com/users/${authorUsername}/following{/other_user}`,
      gists_url: `https://api.github.com/users/${authorUsername}/gists{/gist_id}`,
      starred_url: `https://api.github.com/users/${authorUsername}/starred{/owner}{/repo}`,
      subscriptions_url: `https://api.github.com/users/${authorUsername}/subscriptions`,
      organizations_url: `https://api.github.com/users/${authorUsername}/orgs`,
      repos_url: `https://api.github.com/users/${authorUsername}/repos`,
      events_url: `https://api.github.com/users/${authorUsername}/events{/privacy}`,
      received_events_url: `https://api.github.com/users/${authorUsername}/received_events`,
      type: "User",
      site_admin: false,
    },
  } as PushEvent;
}

/**
 * Generate full GitHub PR event from template
 */
function generatePullRequestEvent(template: PullRequestTemplate): PullRequestEvent {
  const [owner, repoName] = template.repo.split("/");
  const authorUsername = template.author.split("@")[0];
  const prNumber = Math.floor(Math.random() * 1000) + 1;

  return {
    action: "opened",
    number: prNumber,
    pull_request: {
      url: `https://api.github.com/repos/${template.repo}/pulls/${prNumber}`,
      id: Math.floor(Math.random() * 1000000),
      node_id: `PR_${template.id}`,
      html_url: `https://github.com/${template.repo}/pull/${prNumber}`,
      diff_url: `https://github.com/${template.repo}/pull/${prNumber}.diff`,
      patch_url: `https://github.com/${template.repo}/pull/${prNumber}.patch`,
      issue_url: `https://api.github.com/repos/${template.repo}/issues/${prNumber}`,
      number: prNumber,
      state: "open",
      locked: false,
      title: template.title,
      user: {
        login: authorUsername,
        id: Math.floor(Math.random() * 100000),
        node_id: `U_${authorUsername}`,
        avatar_url: `https://avatars.githubusercontent.com/u/${authorUsername}`,
        gravatar_id: null,
        url: `https://api.github.com/users/${authorUsername}`,
        html_url: `https://github.com/${authorUsername}`,
        followers_url: `https://api.github.com/users/${authorUsername}/followers`,
        following_url: `https://api.github.com/users/${authorUsername}/following{/other_user}`,
        gists_url: `https://api.github.com/users/${authorUsername}/gists{/gist_id}`,
        starred_url: `https://api.github.com/users/${authorUsername}/starred{/owner}{/repo}`,
        subscriptions_url: `https://api.github.com/users/${authorUsername}/subscriptions`,
        organizations_url: `https://api.github.com/users/${authorUsername}/orgs`,
        repos_url: `https://api.github.com/users/${authorUsername}/repos`,
        events_url: `https://api.github.com/users/${authorUsername}/events{/privacy}`,
        received_events_url: `https://api.github.com/users/${authorUsername}/received_events`,
        type: "User",
        site_admin: false,
      },
      body: template.body,
      created_at: template.timestamp,
      updated_at: template.timestamp,
      closed_at: null,
      merged_at: null,
      merge_commit_sha: null,
      assignee: null,
      assignees: [],
      requested_reviewers: [],
      requested_teams: [],
      labels: template.labels.map((label) => ({
        id: Math.floor(Math.random() * 10000),
        node_id: `L_${label}`,
        url: `https://api.github.com/repos/${template.repo}/labels/${label}`,
        name: label,
        color: "0e8a16",
        default: false,
        description: null,
      })),
      milestone: null,
      draft: false,
      commits_url: `https://api.github.com/repos/${template.repo}/pulls/${prNumber}/commits`,
      review_comments_url: `https://api.github.com/repos/${template.repo}/pulls/${prNumber}/comments`,
      review_comment_url: `https://api.github.com/repos/${template.repo}/pulls/comments{/number}`,
      comments_url: `https://api.github.com/repos/${template.repo}/issues/${prNumber}/comments`,
      statuses_url: `https://api.github.com/repos/${template.repo}/statuses/{sha}`,
      head: {
        label: `${owner}:feature-branch`,
        ref: "feature-branch",
        sha: template.id,
        user: {
          login: owner,
          id: Math.floor(Math.random() * 100000),
          node_id: `U_${owner}`,
          avatar_url: `https://avatars.githubusercontent.com/u/${owner}`,
          gravatar_id: null,
          url: `https://api.github.com/users/${owner}`,
          html_url: `https://github.com/${owner}`,
          followers_url: `https://api.github.com/users/${owner}/followers`,
          following_url: `https://api.github.com/users/${owner}/following{/other_user}`,
          gists_url: `https://api.github.com/users/${owner}/gists{/gist_id}`,
          starred_url: `https://api.github.com/users/${owner}/starred{/owner}{/repo}`,
          subscriptions_url: `https://api.github.com/users/${owner}/subscriptions`,
          organizations_url: `https://api.github.com/users/${owner}/orgs`,
          repos_url: `https://api.github.com/users/${owner}/repos`,
          events_url: `https://api.github.com/users/${owner}/events{/privacy}`,
          received_events_url: `https://api.github.com/users/${owner}/received_events`,
          type: "Organization",
          site_admin: false,
        },
        repo: {} as any, // Simplified for corpus generation
      },
      base: {
        label: `${owner}:main`,
        ref: "main",
        sha: "base_sha",
        user: {
          login: owner,
          id: Math.floor(Math.random() * 100000),
          node_id: `U_${owner}`,
          avatar_url: `https://avatars.githubusercontent.com/u/${owner}`,
          gravatar_id: null,
          url: `https://api.github.com/users/${owner}`,
          html_url: `https://github.com/${owner}`,
          followers_url: `https://api.github.com/users/${owner}/followers`,
          following_url: `https://api.github.com/users/${owner}/following{/other_user}`,
          gists_url: `https://api.github.com/users/${owner}/gists{/gist_id}`,
          starred_url: `https://api.github.com/users/${owner}/starred{/owner}{/repo}`,
          subscriptions_url: `https://api.github.com/users/${owner}/subscriptions`,
          organizations_url: `https://api.github.com/users/${owner}/orgs`,
          repos_url: `https://api.github.com/users/${owner}/repos`,
          events_url: `https://api.github.com/users/${owner}/events{/privacy}`,
          received_events_url: `https://api.github.com/users/${owner}/received_events`,
          type: "Organization",
          site_admin: false,
        },
        repo: {} as any, // Simplified for corpus generation
      },
      _links: {
        self: { href: `https://api.github.com/repos/${template.repo}/pulls/${prNumber}` },
        html: { href: `https://github.com/${template.repo}/pull/${prNumber}` },
        issue: { href: `https://api.github.com/repos/${template.repo}/issues/${prNumber}` },
        comments: { href: `https://api.github.com/repos/${template.repo}/issues/${prNumber}/comments` },
        review_comments: { href: `https://api.github.com/repos/${template.repo}/pulls/${prNumber}/comments` },
        review_comment: { href: `https://api.github.com/repos/${template.repo}/pulls/comments{/number}` },
        commits: { href: `https://api.github.com/repos/${template.repo}/pulls/${prNumber}/commits` },
        statuses: { href: `https://api.github.com/repos/${template.repo}/statuses/{sha}` },
      },
      author_association: "CONTRIBUTOR",
      auto_merge: null,
      active_lock_reason: null,
    } as any, // Simplified for corpus generation
    repository: {} as any, // Simplified for corpus generation
    sender: {
      login: authorUsername,
      id: Math.floor(Math.random() * 100000),
      node_id: `U_${authorUsername}`,
      avatar_url: `https://avatars.githubusercontent.com/u/${authorUsername}`,
      gravatar_id: null,
      url: `https://api.github.com/users/${authorUsername}`,
      html_url: `https://github.com/${authorUsername}`,
      followers_url: `https://api.github.com/users/${authorUsername}/followers`,
      following_url: `https://api.github.com/users/${authorUsername}/following{/other_user}`,
      gists_url: `https://api.github.com/users/${authorUsername}/gists{/gist_id}`,
      starred_url: `https://api.github.com/users/${authorUsername}/starred{/owner}{/repo}`,
      subscriptions_url: `https://api.github.com/users/${authorUsername}/subscriptions`,
      organizations_url: `https://api.github.com/users/${authorUsername}/orgs`,
      repos_url: `https://api.github.com/users/${authorUsername}/repos`,
      events_url: `https://api.github.com/users/${authorUsername}/events{/privacy}`,
      received_events_url: `https://api.github.com/users/${authorUsername}/received_events`,
      type: "User",
      site_admin: false,
    },
  } as PullRequestEvent;
}

/**
 * Generate full Sentry error webhook from template
 */
function generateSentryError(template: SentryErrorTemplate): SentryErrorWebhook {
  return {
    action: "created",
    data: {
      event: {
        event_id: template.id,
        project: template.project,
        title: template.message,
        message: template.message,
        level: template.level as "error" | "warning" | "info" | "critical",
        platform: "javascript",
        timestamp: template.firstSeen,
        tags: {
          environment: "production",
          server_name: `${template.project}-prod-01`,
        },
        user: null,
        extra: {},
        metadata: {
          title: template.message,
        },
        url: `https://sentry.io/organizations/acme/issues/${template.id}/`,
        issue_url: `https://sentry.io/organizations/acme/issues/${template.id}/`,
      },
    },
    installation: {
      uuid: "installation-uuid",
    },
  };
}
