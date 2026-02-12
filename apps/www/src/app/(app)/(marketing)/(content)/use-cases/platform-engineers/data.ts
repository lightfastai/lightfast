import type { UseCaseItem } from "~/components/use-case-grid";

export const platformEngineersUseCases: UseCaseItem[] = [
  {
    title: "Dependency vulnerability propagation",
    description:
      "When a CVE is published, trace which services, deployments, and customer-facing features are affected",
  },
  {
    title: "Service ownership mapping",
    description:
      "Automatically maintain a map of who owns what, derived from commit history, PR reviews, and incident response patterns",
  },
  {
    title: "Drift detection",
    description:
      "Identify when infrastructure config has drifted from what's declared in code (Terraform state vs. actual)",
  },
  {
    title: "API surface area tracking",
    description:
      "Maintain awareness of every external API contract the startup exposes and consumes",
  },
  {
    title: "Cost attribution per feature",
    description:
      "Trace infrastructure costs back through deployments to the features and teams that drive them",
  },
  {
    title: "Stale resource identification",
    description:
      "Find infrastructure, feature flags, environment variables, and DNS records that are provisioned but unused",
  },
  {
    title: "Security posture snapshot",
    description:
      "Aggregate secrets rotation status, dependency vulnerabilities, access permissions, and exposed endpoints",
  },
  {
    title: "Environment parity scoring",
    description:
      "Measure how far staging has drifted from production",
  },
  {
    title: "Integration health monitoring",
    description:
      "Track the health of every third-party integration (Stripe, Auth0, SendGrid) based on error rates and latency trends",
  },
  {
    title: "Release cadence tracking",
    description:
      "Observe how frequently each team/service ships, and whether it's accelerating or decelerating",
  },
  {
    title: "Scaling event prediction",
    description:
      "Forecast when infrastructure will need to scale based on traffic trends, customer growth, and seasonal patterns",
  },
  {
    title: "Dependency deprecation risk",
    description:
      "Identify dependencies likely to be deprecated based on maintenance activity, GitHub signals, and ecosystem trends",
  },
  {
    title: "Security incident probability",
    description:
      "Based on unpatched vulnerabilities, secrets age, and access patterns, estimate breach probability",
  },
  {
    title: "Infrastructure cost projection",
    description:
      "Based on usage trends and planned features, forecast cloud spend 3/6/12 months out",
  },
  {
    title: "Performance regression prediction",
    description:
      "Based on code complexity metrics and historical correlation with latency, flag PRs likely to cause regressions",
  },
  {
    title: "Database capacity forecasting",
    description:
      "Project storage and query load growth based on feature roadmap and user growth",
  },
  {
    title: "Incident recurrence prediction",
    description:
      "Identify incidents likely to recur based on whether root causes were addressed or just patched",
  },
  {
    title: "Build failure chain analysis",
    description:
      "When builds break, trace through dependency updates, environment changes, and flaky test history",
  },
  {
    title: "Deployment rollback reasoning",
    description:
      "When a rollback occurs, automatically document the full causal chain and affected systems",
  },
  {
    title: "Dependency cascade analysis",
    description:
      "When a third-party service degrades, trace the full blast radius through your stack",
  },
  {
    title: "Infrastructure right-sizing",
    description:
      "Recommend resource allocation changes based on actual usage vs. provisioned capacity",
  },
  {
    title: "Dependency consolidation",
    description:
      "Identify multiple dependencies serving similar functions that could be consolidated",
  },
  {
    title: "CI/CD pipeline optimization",
    description:
      "Identify bottleneck stages, parallelization opportunities, and unnecessary steps",
  },
  {
    title: "Alert threshold tuning",
    description:
      "Recommend alert threshold adjustments based on historical false positive/negative rates",
  },
  {
    title: "Database query optimization targets",
    description:
      "Identify the queries with highest impact on user-facing latency weighted by traffic",
  },
  {
    title: "Environment promotion strategy",
    description:
      "Recommend which changes should be promoted together vs. separately based on coupling",
  },
  {
    title: "Incident runbook generation",
    description:
      "Auto-generate response playbooks from historical incident resolution patterns",
  },
  {
    title: "Deploy-incident temporal pattern detection",
    description:
      "Identify non-obvious time-delayed correlations between deploys and incidents",
  },
  {
    title: "Deployment size anomaly detection",
    description:
      "Flag unusually large or complex deployments that deviate from team norms",
  },
  {
    title: "Error budget burn rate anomalies",
    description:
      "Detect when SLO error budgets are burning faster than expected",
  },
];
