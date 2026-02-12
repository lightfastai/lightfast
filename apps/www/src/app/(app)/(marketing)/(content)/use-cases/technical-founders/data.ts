import type { UseCaseItem } from "~/components/use-case-grid";

export const technicalFoundersUseCases: UseCaseItem[] = [
  {
    title: "Customer impact radius",
    description:
      "For any given service or function, know which customers and revenue streams depend on it",
  },
  {
    title: "Revenue impact estimation",
    description:
      "Given a service degradation, estimate revenue loss per minute based on traffic patterns and conversion funnels",
  },
  {
    title: "Churn risk from incident exposure",
    description:
      "Correlate customer-facing incidents with churn data to predict which customers are at risk after an outage",
  },
  {
    title: "Feature delivery date estimation",
    description:
      "Trace from issue creation through historical PR-to-deploy timelines to give realistic ship dates",
  },
  {
    title: "Customer churn causal analysis",
    description:
      "Trace from a churn event backward through support tickets, incidents, feature gaps, and competitor signals",
  },
  {
    title: "Cost spike attribution",
    description:
      "Trace unexpected cost increases to specific deployments, traffic patterns, or infrastructure changes",
  },
  {
    title: "Feature impact attribution",
    description:
      "Trace from business metrics (conversion, engagement) back to specific feature deployments",
  },
  {
    title: "Revenue per engineering hour",
    description:
      "Trace from engineering time investment through features shipped to revenue impact",
  },
  {
    title: "Optimal deploy window recommendation",
    description:
      "Based on traffic patterns, team availability, and historical incident timing, suggest when to ship",
  },
  {
    title: "Architecture migration sequencing",
    description:
      "When planning a migration, suggest optimal ordering based on dependency graph and risk",
  },
  {
    title: "Vendor replacement analysis",
    description:
      "When a third-party service underperforms, suggest alternatives based on integration complexity and feature parity",
  },
  {
    title: "Engineering ROI by initiative",
    description:
      "Trace from strategic initiatives through epics, issues, PRs, deploys to business metric impact",
  },
  {
    title: "Build vs. buy decision support",
    description:
      "When considering building a feature, surface historical data on how similar internal builds performed vs. third-party alternatives",
  },
  {
    title: "Competitive response speed benchmarking",
    description:
      "Measure time from competitor feature launch (detected via monitoring) to internal implementation",
  },
  {
    title: "Platform reliability as sales asset",
    description:
      "Generate reliability reports for enterprise sales based on actual uptime, incident response times, and resolution patterns",
  },
  {
    title: "Due diligence automation",
    description:
      "For fundraising or M&A, auto-generate technical health reports from the knowledge graph",
  },
  {
    title: "Regulatory compliance mapping",
    description:
      "Trace data flows and access patterns against regulatory requirements (SOC2, GDPR) and identify gaps",
  },
  {
    title: "Product-market fit signal detection",
    description:
      "Correlate feature usage telemetry, support tickets, and churn data to identify PMF signals per feature",
  },
  {
    title: "Acquisition integration planning",
    description:
      "When acquiring a company, model how their stack would integrate based on technology overlap and dependency compatibility",
  },
  {
    title: "Startup health dashboard for investors",
    description:
      "Real-time composite score combining velocity, reliability, cost efficiency, team health, and growth metrics",
  },
  {
    title: "Seasonal reliability patterns",
    description:
      "Identify recurring reliability issues tied to time patterns (end of month billing runs, marketing campaigns)",
  },
  {
    title: "Communication-code gap detection",
    description:
      "Identify when Slack/meeting discussions about architecture diverge from what's actually being built",
  },
  {
    title: "Implicit architecture emergence",
    description:
      "Detect when a new architectural pattern is emerging organically across teams without explicit design",
  },
  {
    title: "Cross-customer issue correlation",
    description:
      "Identify when seemingly unrelated customer complaints share a technical root cause",
  },
  {
    title: "Effort-outcome mismatch detection",
    description:
      "Flag areas where engineering effort is high but measurable output (deploys, issue closure, metric impact) is low",
  },
];
