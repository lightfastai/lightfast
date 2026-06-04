import { ArrowRight } from "lucide-react";
import { NavLink } from "~/components/nav-link";
import { FaqAccordion } from "./faq-accordion";

export const faqs = [
  {
    question: "What is Lightfast?",
    answer:
      "Lightfast is the superintelligence layer for founders. Built on a unified operating layer, it observes what's happening across your tools, remembers what happened, and gives agents and people a single system to reason and act through — without knowing which tools exist or how they work.",
  },
  {
    question: "What does 'operating layer' mean?",
    answer:
      "Think of Lightfast like an OS for your organization's working memory. Agents and people query a shared substrate, get grounded context, and take action through the APIs you control.",
  },
  {
    question: "How do teams use Lightfast?",
    answer:
      "Teams create an organization, invite members by email, add API keys, and query workspace memory through the REST API, TypeScript SDK, and MCP server.",
  },
  {
    question: "How does the event system work?",
    answer:
      "Lightfast stores structured observations and decisions as normalized events you can subscribe to, filter, and act on. Events are immutable and causally ordered — facts your agents and workflows can rely on.",
  },
  {
    question: "How do agents and AI assistants use Lightfast?",
    answer:
      "Lightfast provides a REST API, TypeScript SDK, and MCP (Model Context Protocol) tools that any agent can use. Agents can search your workspace, get cited answers, find related context, and express intent that Lightfast resolves to the right tool and action. Same primitives for agents and people.",
  },
  {
    question: "What's coming after events?",
    answer:
      "Next is Memory — semantic search and cited answers across your organization's working context. After that, full orchestration: agents express what they want in natural language, and Lightfast enforces your rules, routes work through your systems, and tracks everything.",
  },
  {
    question: "Is our data secure and private?",
    answer:
      "Every workspace is completely isolated — separate database schemas, separate vector namespaces, separate storage. Your data never mixes with others. We use industry-standard encryption at rest and in transit, and we never train on your data. You can delete your data anytime.",
  },
  {
    question: "How quickly can we get started?",
    answer:
      "Minutes. Sign in with email, create an organization, issue an API key, and connect AI assistants through MCP. Newly created organizations are usable immediately.",
  },
  {
    question: "How does pricing work?",
    answer:
      "We offer a free Starter plan for small teams. Team plan is $20/user/month with full event access and semantic search. Business plan includes advanced security and support. Check our pricing page for full details.",
  },
];

export function FAQSection() {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-16">
        {/* Left: Badge */}
        <div>
          <span className="inline-flex h-7 items-center rounded-md border border-border bg-card/40 px-3 text-muted-foreground text-sm">
            FAQ
          </span>
        </div>

        {/* Right: FAQ content - spans 2 columns */}
        <div className="lg:col-span-2">
          {/* Header with CTA */}
          <div className="mb-8 flex flex-col border-border border-b pb-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <p className="text-base text-muted-foreground leading-relaxed md:text-lg">
                Learn how Lightfast works.
              </p>
            </div>

            <div className="mt-6 lg:mt-0 lg:text-right">
              <p className="mb-2 text-muted-foreground text-sm">
                Ready to get started?
              </p>
              <NavLink
                className="group inline-flex items-center gap-2 font-medium text-foreground text-sm transition-colors hover:text-muted-foreground"
                href="/sign-up"
                microfrontend
                prefetch
              >
                Get started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </NavLink>
            </div>
          </div>

          {/* FAQ Accordion — client JS loaded lazily (below the fold) */}
          <FaqAccordion faqs={faqs} />
        </div>
      </div>
    </div>
  );
}
