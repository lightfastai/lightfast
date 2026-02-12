import type { UseCaseItem } from "~/components/use-case-grid";

export const engineeringLeadersUseCases: UseCaseItem[] = [
  {
    title: "Team cognitive load estimation",
    description:
      "Based on active PRs, open issues, on-call rotations, and meeting density, estimate how overloaded each person is",
  },
  {
    title: "On-call burden distribution",
    description:
      "Track who gets paged, how often, at what hours, and whether it's equitable",
  },
  {
    title: "Sprint completion prediction",
    description:
      "Based on historical velocity, current WIP, PR cycle times, and team availability, predict what will actually ship this sprint",
  },
  {
    title: "Hire timing prediction",
    description:
      "Based on team load trends, velocity changes, and planned roadmap, predict when a team will need to grow",
  },
  {
    title: "Support ticket volume prediction",
    description:
      "Correlate deployments and feature launches with historical support ticket patterns",
  },
  {
    title: "Velocity change attribution",
    description:
      "When team velocity drops, correlate with: tech debt load, on-call burden, meeting density, dependency blockers",
  },
  {
    title: "Team attrition risk signals",
    description:
      "Declining commit frequency, reduced PR engagement, increased off-hours work as leading indicators",
  },
  {
    title: "Meeting-to-decision-to-code tracing",
    description:
      "Link business decisions (from meeting notes/Slack) through issues to implementations to outcomes",
  },
  {
    title: "On-call rotation optimization",
    description:
      "Balance on-call load considering expertise, timezone, recent burden, and system knowledge",
  },
  {
    title: "Knowledge sharing recommendations",
    description:
      "Suggest pairing or knowledge transfer sessions based on bus factor analysis",
  },
  {
    title: "Sprint planning suggestions",
    description:
      "Recommend issue combinations that minimize context switching and maximize dependency resolution",
  },
  {
    title: "Code review bottleneck resolution",
    description:
      "Identify and suggest fixes for review queue bottlenecks",
  },
  {
    title: "Documentation generation priority",
    description:
      "Suggest which undocumented systems need docs most urgently based on bus factor and change frequency",
  },
  {
    title: "Cross-team collaboration pattern mapping",
    description:
      "Detect emerging cross-team dependencies before they become bottlenecks",
  },
  {
    title: "Code quality trend anomalies",
    description:
      "Detect when a codebase area is deteriorating faster than normal",
  },
  {
    title: "Unusual access pattern detection",
    description:
      "Flag anomalous repository, infrastructure, or data access patterns",
  },
  {
    title: "Innovation velocity tracking",
    description:
      "Distinguish between feature work, maintenance, and innovation in engineering output",
  },
  {
    title: "Workflow anti-pattern detection",
    description:
      "Identify process smells like PRs that bypass review, direct-to-main commits, or skipped staging",
  },
  {
    title: "Team rhythm disruption detection",
    description:
      "Notice when a team's normal patterns (standup cadence, PR frequency, deploy rhythm) break",
  },
  {
    title: "Regression cycle detection",
    description:
      "Identify bugs that keep getting reintroduced after being fixed",
  },
  {
    title: "Engineering culture health scoring",
    description:
      "Synthesize code review tone, collaboration patterns, knowledge sharing, and on-call equity into a culture metric",
  },
  {
    title: "Knowledge gap finder",
    description:
      "Find areas of the codebase with single-point-of-failure knowledge where only one person has context",
  },
  {
    title: "Context prefetcher for meetings",
    description:
      "Before a planning meeting, prefetch all relevant context: recent changes, open issues, past decisions, and key owners",
  },
  {
    title: "Sprint reporter",
    description:
      "Generate a sprint summary: completed work, open blockers, decisions made, and carryover items with context",
  },
  {
    title: "Capacity planner",
    description:
      "Find all scaling discussions, performance issues, and infrastructure decisions from the past 6 months for quarterly planning",
  },
];
