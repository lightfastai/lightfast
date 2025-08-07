import * as React from "react";
import { Check, X } from "lucide-react";

const features = [
  {
    category: "Infrastructure",
    items: [
      { name: "Agent Executions", hobby: "1,000/mo", pro: "50,000/mo", enterprise: "Unlimited" },
      { name: "Compute Resources", hobby: "Shared", pro: "Dedicated", enterprise: "Custom" },
      { name: "Execution Speed", hobby: "Standard", pro: "10x Faster", enterprise: "Maximum" },
      { name: "Global CDN", hobby: true, pro: true, enterprise: true },
      { name: "Auto-scaling", hobby: false, pro: true, enterprise: true },
      { name: "Multi-region", hobby: false, pro: false, enterprise: true },
    ],
  },
  {
    category: "Developer Experience",
    items: [
      { name: "Git Integration", hobby: true, pro: true, enterprise: true },
      { name: "API Access", hobby: true, pro: true, enterprise: true },
      { name: "CLI Tools", hobby: true, pro: true, enterprise: true },
      { name: "Custom Domains", hobby: false, pro: true, enterprise: true },
      { name: "Environment Variables", hobby: "3", pro: "Unlimited", enterprise: "Unlimited" },
      { name: "Webhooks", hobby: false, pro: true, enterprise: true },
    ],
  },
  {
    category: "Observability",
    items: [
      { name: "Basic Logs", hobby: "1 hour", pro: "7 days", enterprise: "90 days" },
      { name: "Metrics Dashboard", hobby: false, pro: true, enterprise: true },
      { name: "Error Tracking", hobby: false, pro: true, enterprise: true },
      { name: "Performance Insights", hobby: false, pro: true, enterprise: true },
      { name: "Custom Alerts", hobby: false, pro: "5", enterprise: "Unlimited" },
      { name: "Log Export", hobby: false, pro: false, enterprise: true },
    ],
  },
  {
    category: "Security & Compliance",
    items: [
      { name: "SSL Certificates", hobby: true, pro: true, enterprise: true },
      { name: "DDoS Protection", hobby: true, pro: true, enterprise: true },
      { name: "WAF Rules", hobby: "Basic", pro: "Advanced", enterprise: "Custom" },
      { name: "SAML SSO", hobby: false, pro: false, enterprise: true },
      { name: "SCIM Provisioning", hobby: false, pro: false, enterprise: true },
      { name: "SOC 2 Compliance", hobby: false, pro: true, enterprise: true },
      { name: "HIPAA Compliance", hobby: false, pro: false, enterprise: true },
      { name: "Custom SLA", hobby: false, pro: false, enterprise: true },
    ],
  },
  {
    category: "Support",
    items: [
      { name: "Community Forum", hobby: true, pro: true, enterprise: true },
      { name: "Email Support", hobby: false, pro: true, enterprise: true },
      { name: "Priority Support", hobby: false, pro: true, enterprise: true },
      { name: "Phone Support", hobby: false, pro: false, enterprise: true },
      { name: "Dedicated Manager", hobby: false, pro: false, enterprise: true },
      { name: "Response Time", hobby: "Best effort", pro: "24 hours", enterprise: "1 hour" },
    ],
  },
];

function FeatureValue({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="h-5 w-5 text-primary mx-auto" />
    ) : (
      <X className="h-5 w-5 text-muted-foreground mx-auto" />
    );
  }
  return <span className="text-sm">{value}</span>;
}

export function PricingComparison() {
  return (
    <section className="px-6 lg:px-8 py-24 bg-muted/30">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">
            Compare Plans
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Detailed comparison of features across all plans
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-4 font-medium">Features</th>
                <th className="text-center p-4 font-medium">Hobby</th>
                <th className="text-center p-4 font-medium">Pro</th>
                <th className="text-center p-4 font-medium">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {features.map((category) => (
                <React.Fragment key={category.category}>
                  <tr className="border-t bg-muted/50">
                    <td colSpan={4} className="p-4 font-semibold">
                      {category.category}
                    </td>
                  </tr>
                  {category.items.map((item) => (
                    <tr key={item.name} className="border-t">
                      <td className="p-4 text-sm">{item.name}</td>
                      <td className="p-4 text-center">
                        <FeatureValue value={item.hobby} />
                      </td>
                      <td className="p-4 text-center">
                        <FeatureValue value={item.pro} />
                      </td>
                      <td className="p-4 text-center">
                        <FeatureValue value={item.enterprise} />
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}