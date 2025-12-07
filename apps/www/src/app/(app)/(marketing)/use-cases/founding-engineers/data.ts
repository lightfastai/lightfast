import type { UseCaseItem } from "~/components/use-case-grid";

export const foundingEngineersUseCases: UseCaseItem[] = [
  {
    title: "Understand the codebase fast",
    description:
      "I just joined. Give me an overview of the main services, how they communicate, and where the core business logic lives.",
  },
  {
    title: "Find who to ask",
    description:
      "Who has the most context on the checkout flow? I need to make changes and want to know who can review.",
  },
  {
    title: "Decode a cryptic PR",
    description:
      "This PR from 4 months ago has no description. What was it trying to solve? Find related discussions.",
  },
  {
    title: "Understand why not how",
    description:
      "I can read the code, but why was it built this way? Find the original discussion or design decision.",
  },
  {
    title: "Debug without bothering anyone",
    description:
      "This error is happening in production. Has anyone seen it before? Show me related incidents and fixes.",
  },
  {
    title: "Learn the patterns",
    description:
      "What's our standard pattern for adding a new API endpoint? Show me examples and any style guide discussions.",
  },
  {
    title: "Find the gotchas",
    description:
      "I'm about to modify the payment service. What are the known issues, edge cases, or things I should watch out for?",
  },
  {
    title: "Understand naming conventions",
    description:
      "Why is this service called 'hermes'? Is there a naming convention I should follow for new services?",
  },
  {
    title: "Trace a customer issue",
    description:
      "A customer reported this bug. Has it been discussed before? Show me any related Slack threads or tickets.",
  },
  {
    title: "Find test patterns",
    description:
      "How do we test integrations with Stripe? Show me existing tests and any discussions about test strategy.",
  },
  {
    title: "Understand deployment",
    description:
      "How do I deploy to staging? Walk me through the process with links to the relevant docs and scripts.",
  },
  {
    title: "Learn from past incidents",
    description:
      "What incidents have we had in the past 3 months? I want to understand what can go wrong.",
  },
  {
    title: "Find related changes",
    description:
      "I'm changing this function. What else in the codebase depends on it? Show me callers and related PRs.",
  },
  {
    title: "Understand feature flags",
    description:
      "What feature flags are currently active? Which ones are safe to remove and which are still in use?",
  },
  {
    title: "Get up to speed on a service",
    description:
      "I need to work on the notification service next week. Give me everything I need to know: architecture, owners, recent changes, known issues.",
  },
  {
    title: "Find the original spec",
    description:
      "Was there a design doc for this feature? Find any planning documents, RFCs, or spec discussions.",
  },
  {
    title: "Understand data flow",
    description:
      "How does user data flow from signup to the analytics dashboard? Map out the services and transformations involved.",
  },
  {
    title: "Check for breaking changes",
    description:
      "I want to change this API response format. Has anyone discussed backward compatibility requirements?",
  },
  {
    title: "Find environment setup",
    description:
      "How do I set up the local development environment? Find the setup guide and any troubleshooting discussions.",
  },
  {
    title: "Understand the monorepo",
    description:
      "How is this monorepo organized? What packages depend on what and where should I add new code?",
  },
  {
    title: "Find security patterns",
    description:
      "How do we handle user authentication in API routes? Show me the standard pattern and any security considerations.",
  },
  {
    title: "Understand error handling",
    description:
      "What's our approach to error handling and logging? Find examples and any discussions about error reporting.",
  },
  {
    title: "Learn the review process",
    description:
      "What's expected in a PR review here? Find discussions about code review standards and what reviewers look for.",
  },
  {
    title: "Find database patterns",
    description:
      "How do we handle database migrations? Show me the process and any past issues with migrations.",
  },
  {
    title: "Understand caching strategy",
    description:
      "Where and how do we use caching? Find the caching patterns and any discussions about cache invalidation.",
  },
  {
    title: "Find API conventions",
    description:
      "What are our API naming conventions? Show me the standards for endpoints, parameters, and response formats.",
  },
  {
    title: "Understand async patterns",
    description:
      "How do we handle background jobs and async processing? Find the queue setup and job patterns we use.",
  },
  {
    title: "Find monitoring setup",
    description:
      "How do I add monitoring to a new feature? Show me our observability patterns and alerting conventions.",
  },
  {
    title: "Understand CI/CD",
    description:
      "How does our CI/CD pipeline work? What checks run on PRs and how does deployment happen?",
  },
  {
    title: "Find performance patterns",
    description:
      "What performance optimizations have we made? Show me discussions about query optimization and caching decisions.",
  },
  {
    title: "Understand third-party integrations",
    description:
      "How do we integrate with external APIs? Find patterns for rate limiting, retries, and error handling.",
  },
  {
    title: "Find rollback procedures",
    description:
      "How do I roll back a bad deployment? Find the rollback process and any past rollback incidents.",
  },
  {
    title: "Understand access control",
    description:
      "How do we handle permissions and access control? Find the RBAC implementation and any authorization patterns.",
  },
  {
    title: "Find config management",
    description:
      "How do we manage environment variables and config? Show me the patterns for secrets and feature toggles.",
  },
  {
    title: "Understand the type system",
    description:
      "What TypeScript patterns do we use? Find discussions about type safety, generics, and shared type definitions.",
  },
];
