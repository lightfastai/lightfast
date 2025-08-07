import Link from "next/link";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Badge } from "@repo/ui/components/ui/badge";
import { Check } from "lucide-react";

const plans = [
  {
    name: "Hobby",
    description: "Perfect for experimenting with AI agents and personal projects.",
    price: "Free",
    priceDetail: "forever",
    features: [
      "1,000 agent executions/month",
      "Basic compute resources",
      "Community support",
      "Public agent deployments",
      "Standard execution speed",
      "Basic observability",
    ],
    cta: "Start Building",
    href: "/signup",
    popular: false,
  },
  {
    name: "Pro",
    description: "Everything you need to build and scale production AI agents.",
    price: "$29",
    priceDetail: "/month + usage",
    features: [
      "50,000 agent executions/month",
      "Enhanced compute resources",
      "Priority email support",
      "Private agent deployments",
      "10x faster execution",
      "Advanced observability & logs",
      "Custom domains",
      "Team collaboration",
    ],
    cta: "Start Free Trial",
    href: "/signup?plan=pro",
    popular: true,
  },
  {
    name: "Enterprise",
    description: "Critical security, performance, compliance, and dedicated support.",
    price: "Custom",
    priceDetail: "pricing",
    features: [
      "Unlimited agent executions",
      "Dedicated compute resources",
      "24/7 phone & email support",
      "Private cloud deployment",
      "Guaranteed SLAs",
      "Advanced security features",
      "SAML SSO & SCIM",
      "Custom contracts & invoicing",
      "Dedicated success manager",
    ],
    cta: "Contact Sales",
    href: "/contact/sales",
    popular: false,
  },
];

export function PricingCards() {
  return (
    <section className="px-6 lg:px-8 pb-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card 
              key={plan.name} 
              className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    Popular
                  </Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription className="mt-2">
                  {plan.description}
                </CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground ml-2">
                    {plan.priceDetail}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="ml-3 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  variant={plan.popular ? "default" : "outline"}
                  asChild
                >
                  <Link href={plan.href}>
                    {plan.cta}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-16 border rounded-lg p-8 bg-muted/30">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold">Need help choosing?</h3>
              <p className="text-muted-foreground mt-1">
                Our team can help you find the perfect plan for your needs.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/contact">
                Talk to an expert
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}