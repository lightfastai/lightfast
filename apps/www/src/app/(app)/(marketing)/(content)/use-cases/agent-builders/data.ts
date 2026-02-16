import type { UseCaseItem } from "~/components/use-case-grid";

export const agentBuildersUseCases: UseCaseItem[] = [
  {
    title: "Real-time stack health pulse",
    description:
      "Synthesize signals across all tools into a single 'how healthy is the system right now' assessment",
  },
  {
    title: "Deployment risk scoring",
    description:
      "Given what's in a PR, what infrastructure it touches, and historical incident data, score the risk of shipping it",
  },
  {
    title: "Undocumented tribal knowledge detection",
    description:
      "Find critical systems that only one person has ever committed to or reviewed",
  },
  {
    title: "Shadow dependency discovery",
    description:
      "Detect runtime dependencies that aren't declared in package manifests (HTTP calls between services, shared databases)",
  },
  {
    title: "Data flow mapping",
    description:
      "Trace how user data moves through services, databases, and third-party tools for compliance awareness",
  },
  {
    title: "Technical debt inventory",
    description:
      "Classify and quantify debt: outdated dependencies, TODO comments, skipped tests, workaround patterns",
  },
  {
    title: "Knowledge freshness scoring",
    description:
      "Identify documentation, runbooks, and design docs that are stale relative to the code they describe",
  },
  {
    title: "Sentry error prediction from deploy diff",
    description:
      "Given the files changed in a deployment, predict which error classes are likely to spike based on historical patterns",
  },
  {
    title: "Outage probability forecasting",
    description:
      "Based on current error rate trajectories, dependency health, and deploy frequency, estimate probability of an outage in the next N hours",
  },
  {
    title: "Merge conflict probability",
    description:
      "Given active branches and their file overlap, predict which PRs are likely to conflict",
  },
  {
    title: "Test flakiness prediction",
    description:
      "Identify tests likely to become flaky based on their coupling to frequently-changed code",
  },
  {
    title: "Build time regression forecasting",
    description:
      "Predict when CI/CD pipeline duration will cross acceptable thresholds based on codebase growth trends",
  },
  {
    title: "API breaking change impact prediction",
    description:
      "When an API contract changes, predict which consumers will break based on actual usage patterns",
  },
  {
    title: "Performance regression prediction",
    description:
      "Based on code complexity metrics and historical correlation with latency, flag PRs likely to cause regressions",
  },
  {
    title: "Automated incident root cause tracing",
    description:
      "When a Sentry error spikes, trace backward through the graph: which deploy, which PR, which commit, which issue prompted the change",
  },
  {
    title: "Performance regression attribution",
    description:
      "When latency increases, identify the causal chain: deploy → code change → specific function → database query",
  },
  {
    title: "Error clustering by root cause",
    description:
      "Group Sentry errors not by stack trace similarity but by shared causal origin (same PR, same dependency, same config change)",
  },
  {
    title: "Cross-service incident correlation",
    description:
      "Identify when errors in Service A were caused by changes in Service B through shared dependencies",
  },
  {
    title: "Flaky test root cause",
    description:
      "Correlate test flakiness with infrastructure state, concurrent builds, and resource contention",
  },
  {
    title: "Alert fatigue analysis",
    description:
      "Identify which alerts are symptoms of the same underlying issue and should be deduplicated",
  },
  {
    title: "PR reviewer recommendation",
    description:
      "Suggest reviewers based on file expertise, current workload, and knowledge distribution goals",
  },
  {
    title: "Tech debt prioritization",
    description:
      "Rank technical debt items by impact on velocity, incident risk, and cost, weighted against effort",
  },
  {
    title: "Test coverage optimization",
    description:
      "Identify which untested code paths have the highest incident correlation and prioritize coverage there",
  },
  {
    title: "Feature flag cleanup prioritization",
    description:
      "Rank stale feature flags by risk (how much code they gate, how long since last toggle)",
  },
  {
    title: "Monolith extraction candidates",
    description:
      "Identify service boundaries within a monolith based on code coupling, team ownership, and deployment frequency",
  },
];
