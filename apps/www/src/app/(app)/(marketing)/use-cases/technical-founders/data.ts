import type { UseCaseItem } from "~/components/use-case-grid";

export const technicalFoundersUseCases: UseCaseItem[] = [
  {
    title: "Onboard your first hire",
    description:
      "Give me a summary of how authentication works in our codebase, including which services handle login, session management, and token refresh.",
  },
  {
    title: "Answer the 'why' questions",
    description:
      "Why did we choose Postgres over MongoDB for the main database? Show me the discussions and decisions that led to this choice.",
  },
  {
    title: "Explain a past incident",
    description:
      "What happened during the payment outage last month? Who was involved, what was the root cause, and what did we change?",
  },
  {
    title: "Find who owns what",
    description:
      "Who has the most context on the billing service? Show me who's made changes and discussed it recently.",
  },
  {
    title: "Recall a Slack decision",
    description:
      "Find the Slack thread where we decided to use rate limiting on the API. What were the key arguments?",
  },
  {
    title: "Trace a feature's history",
    description:
      "Show me the full history of our notification system—when it was built, major changes, and any incidents related to it.",
  },
  {
    title: "Prepare for investor questions",
    description:
      "What technical decisions have we made in the last quarter? Give me a summary I can share with investors.",
  },
  {
    title: "Unblock a stuck contractor",
    description:
      "The contractor is asking how our webhook system works. Give them everything they need to understand it without a call.",
  },
  {
    title: "Remember your own decisions",
    description:
      "What was my reasoning when I chose this API structure six months ago? Find my comments and PRs from that time.",
  },
  {
    title: "Hand off context before vacation",
    description:
      "Generate a summary of everything I've been working on this sprint so my co-founder can cover while I'm out.",
  },
  {
    title: "Resolve conflicting approaches",
    description:
      "We have two different patterns for error handling in the codebase. Which one did we agree to use and why?",
  },
  {
    title: "Stop repeating yourself",
    description:
      "How many times have I explained how our deployment pipeline works? Find all the times this was discussed.",
  },
  {
    title: "Debug with historical context",
    description:
      "This bug looks familiar. Have we seen this pattern before? Show me similar issues and how they were resolved.",
  },
  {
    title: "Justify technical debt",
    description:
      "Why do we have this workaround in the payment flow? Find the original discussion about why it was added.",
  },
  {
    title: "Track architecture evolution",
    description:
      "How has our database schema evolved over the past year? Show me the major migrations and why they happened.",
  },
  {
    title: "Find undocumented APIs",
    description:
      "What internal APIs do we have that aren't in the docs? List them with who created them and what they do.",
  },
  {
    title: "Understand dependency choices",
    description:
      "Why are we using this specific version of the auth library? Was there a security issue or compatibility reason?",
  },
  {
    title: "Recover lost context",
    description:
      "I remember discussing a caching strategy but can't find it. Search all our channels for conversations about Redis caching.",
  },
  {
    title: "Brief a new advisor",
    description:
      "Our new technical advisor needs to understand our stack. Generate an overview of our architecture, key decisions, and current challenges.",
  },
  {
    title: "Recall customer commitments",
    description:
      "What did we promise Enterprise Customer X about the API timeline? Find all discussions and commitments we made.",
  },
  {
    title: "Understand a legacy system",
    description:
      "Nobody remembers why the legacy auth system works this way. Find the original implementation discussions and decisions.",
  },
  {
    title: "Prepare for a board meeting",
    description:
      "What engineering progress have we made this quarter? Summarize shipped features, resolved incidents, and infrastructure improvements.",
  },
  {
    title: "Find the security review",
    description:
      "Did we ever do a security review of the payment integration? Find any audits, discussions, or concerns raised.",
  },
  {
    title: "Recall partnership decisions",
    description:
      "Why did we choose Stripe over Adyen? Find the evaluation criteria and final decision discussion.",
  },
  {
    title: "Track compliance requirements",
    description:
      "What GDPR-related changes have we made? Show me all PRs and discussions about data privacy compliance.",
  },
  {
    title: "Understand cost decisions",
    description:
      "Why did we move from AWS to GCP for this service? Find the cost analysis and migration decision.",
  },
  {
    title: "Find the original spec",
    description:
      "Was there ever a spec for the search feature? Find any design docs, mockups, or requirements discussions.",
  },
  {
    title: "Recall hiring context",
    description:
      "What were we looking for when we hired the first backend engineer? Find the job description discussions and interview criteria.",
  },
  {
    title: "Understand scaling decisions",
    description:
      "Why did we add that second database replica? Find the performance discussions that led to this decision.",
  },
  {
    title: "Track vendor evaluations",
    description:
      "What monitoring tools did we evaluate before choosing Datadog? Show me the comparison and decision rationale.",
  },
  {
    title: "Find the rollback plan",
    description:
      "We discussed a rollback strategy for the new checkout flow. Where is that plan and who owns it?",
  },
  {
    title: "Recall API versioning decisions",
    description:
      "How did we decide on our API versioning strategy? Find the discussions about v1 vs v2 approaches.",
  },
  {
    title: "Understand testing strategy",
    description:
      "What's our agreed approach to integration testing? Find discussions about test coverage and CI/CD requirements.",
  },
  {
    title: "Track open source contributions",
    description:
      "What open source libraries have we contributed to or forked? Show me the decisions and any patches we maintain.",
  },
  {
    title: "Find the launch checklist",
    description:
      "What was our go-live checklist for the last major release? Find the preparation discussions and any issues we hit.",
  },
];
