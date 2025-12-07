import type { UseCaseItem } from "~/components/use-case-grid";

export const agentBuildersUseCases: UseCaseItem[] = [
  {
    title: "Build a support bot",
    description:
      "Search our internal docs and past tickets to answer: 'How do I reset my API key?' Return the answer with links to the relevant help articles.",
  },
  {
    title: "Create a code review assistant",
    description:
      "This PR modifies the payment service. Find our coding standards, past reviews of similar changes, and any known gotchas in this area.",
  },
  {
    title: "Power an onboarding agent",
    description:
      "New engineer asks: 'How does authentication work?' Return a structured answer with links to the relevant PRs, docs, and architecture diagrams.",
  },
  {
    title: "Build an incident responder",
    description:
      "We're seeing elevated error rates in checkout. Find similar past incidents, who resolved them, and what the fix was.",
  },
  {
    title: "Create a decision logger",
    description:
      "The team just decided to use Redis for session storage. Find the discussion, extract the key arguments, and store it as a decision record.",
  },
  {
    title: "Build a PR summarizer",
    description:
      "Summarize this PR in the context of our codebase. What does it change, why, and what related code might be affected?",
  },
  {
    title: "Power a Slack bot",
    description:
      "Someone asks in Slack: 'Who owns the billing service?' Query Lightfast and return the answer with context about recent activity.",
  },
  {
    title: "Create an architecture assistant",
    description:
      "Engineer asks: 'Should I use the existing queue or create a new one?' Find our architecture decisions about queues and provide guidance.",
  },
  {
    title: "Build a changelog generator",
    description:
      "Generate a weekly changelog by finding all merged PRs, grouping them by area, and summarizing the changes for stakeholders.",
  },
  {
    title: "Power a docs updater",
    description:
      "This PR changes the API response format. Find all docs that reference this endpoint and flag them for update.",
  },
  {
    title: "Create a dependency advisor",
    description:
      "We want to upgrade React. Find all discussions about React in our history, any past upgrade issues, and who has context.",
  },
  {
    title: "Build a standup summarizer",
    description:
      "Summarize what each team member worked on yesterday based on their PRs, commits, and Slack activity.",
  },
  {
    title: "Power a security scanner",
    description:
      "Find all places in our codebase where we handle user passwords. Return file paths, owners, and when they were last reviewed.",
  },
  {
    title: "Create a knowledge extractor",
    description:
      "Extract all technical decisions from the last month's Slack threads and organize them by topic with sources.",
  },
  {
    title: "Build a context prefetcher",
    description:
      "Before a planning meeting about the API, prefetch all relevant context: recent changes, open issues, past decisions, and key owners.",
  },
  {
    title: "Power a ticket enricher",
    description:
      "New bug ticket: 'Checkout fails sometimes.' Find similar past issues, relevant code, and suggested owners to assign.",
  },
  {
    title: "Create an API assistant",
    description:
      "Developer asks: 'How do I use the /v1/search endpoint?' Return usage examples from our codebase plus the official docs.",
  },
  {
    title: "Build a migration planner",
    description:
      "We're planning to migrate from service A to service B. Find all dependencies, consumers, and discussions about this migration.",
  },
  {
    title: "Power a release notes writer",
    description:
      "Generate customer-facing release notes from this week's merged PRs. Focus on user-visible changes and link to relevant docs.",
  },
  {
    title: "Create a test coverage advisor",
    description:
      "This new feature lacks tests. Find our testing patterns for similar features and suggest what tests should be written.",
  },
  {
    title: "Build an ownership mapper",
    description:
      "Map every service in our codebase to its owner. Return a structured list with last activity and expertise level.",
  },
  {
    title: "Power a meeting prep agent",
    description:
      "Prepare for a 1:1 with the backend lead. Find their recent work, open PRs, blockers mentioned in Slack, and relevant context.",
  },
  {
    title: "Create a deprecation tracker",
    description:
      "Find all deprecated functions in our codebase. List them with who added the deprecation, when, and suggested replacements.",
  },
  {
    title: "Build a compliance checker",
    description:
      "Check if this PR follows our security guidelines. Find the relevant policies and flag any potential violations.",
  },
  {
    title: "Power an estimation helper",
    description:
      "We need to estimate this feature. Find similar past features, how long they took, and what complications arose.",
  },
  {
    title: "Create a postmortem assistant",
    description:
      "We just had an incident. Gather all relevant context: timeline from Slack, related PRs, similar past incidents, and affected systems.",
  },
  {
    title: "Build a refactoring advisor",
    description:
      "I want to refactor this module. Find all usages, related discussions about technical debt, and any previous refactoring attempts.",
  },
  {
    title: "Power a documentation generator",
    description:
      "Generate API documentation for this service based on the code, existing docs, and discussions about its behavior.",
  },
  {
    title: "Create a sprint reporter",
    description:
      "Generate a sprint summary: completed work, open blockers, decisions made, and carryover items with context.",
  },
  {
    title: "Build a knowledge gap finder",
    description:
      "Find areas of the codebase with single-point-of-failure knowledge. Flag services where only one person has context.",
  },
  {
    title: "Power a conflict resolver",
    description:
      "Two engineers disagree on an approach. Find relevant past decisions, similar debates, and how they were resolved.",
  },
  {
    title: "Create a tech debt tracker",
    description:
      "Find all TODOs, FIXMEs, and hack comments in the codebase. Organize them by age, owner, and related discussions.",
  },
  {
    title: "Build an alert correlator",
    description:
      "This alert fired. Find the runbook, past occurrences, related code changes, and who typically handles it.",
  },
  {
    title: "Power a capacity planner",
    description:
      "We're planning next quarter. Find all scaling discussions, performance issues, and infrastructure decisions from the past 6 months.",
  },
  {
    title: "Create an interview prep agent",
    description:
      "Prepare technical interview questions based on our actual codebase challenges, past incidents, and architectural decisions.",
  },
];
