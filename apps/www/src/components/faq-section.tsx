import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { cn } from "@repo/ui/lib/utils";

const faqs = [
  {
    question: "What is Lightfast?",
    answer:
      "Lightfast is memory built for teams. It's a knowledge search platform that indexes everything your team knows—from GitHub PRs and issues to Linear tickets, Slack conversations, Notion docs, and more. Unlike traditional search, Lightfast understands meaning, not just keywords, and every answer comes with its source so you can verify and trust the information.",
  },
  {
    question: "How is this different from regular search?",
    answer:
      "Traditional search matches keywords. Lightfast understands intent and meaning. Ask 'who knows about authentication' and it finds the people who've worked on auth code, discussed auth issues, or reviewed auth PRs—even if they never used that exact word. It's semantic search plus Neural Memory that tracks decisions, changes, and expertise across your entire organization.",
  },
  {
    question: "What is Neural Memory?",
    answer:
      "Neural Memory captures the important moments in your team's history—decisions made, incidents resolved, features shipped. It builds expertise profiles showing who knows what, tracks how things evolved over time, and generates summaries of team activity. This enables powerful queries like 'what decisions were made about the database migration' or 'who has context on the payment system'.",
  },
  {
    question: "What tools and platforms do you integrate with?",
    answer:
      "We integrate with GitHub (code, PRs, issues, discussions), Linear (tickets, projects), Slack (conversations, threads), Notion (docs, wikis), Confluence (documentation), and more coming soon. Each integration is a 'source'—an entire GitHub org or Slack workspace counts as one source. We continuously sync to keep your knowledge fresh.",
  },
  {
    question: "How do agents and AI assistants use Lightfast?",
    answer:
      "Lightfast provides a simple 4-route API and MCP (Model Context Protocol) tools that any agent can use. Instead of dumping entire codebases into context, agents can search for exactly what they need, get answers with citations, and find related content. This means agents can access your entire knowledge base without token limits or hallucination risks.",
  },
  {
    question: "Is our data secure and private?",
    answer:
      "Absolutely. Every workspace is completely isolated—separate database schemas, separate vector namespaces, separate storage buckets. Your data never mixes with others. We use industry-standard encryption, and you can delete your data anytime. We never train models on your data, and we never share it with anyone.",
  },
  {
    question: "How quickly can we get started?",
    answer:
      "You can be searching in minutes. Connect your first source (like GitHub), and we'll start indexing immediately. Most teams see initial results within 5-10 minutes, with full indexing complete within hours depending on size. Our API has just 4 routes, and we provide SDKs for Python, TypeScript, and MCP tools for agents. No complex setup required.",
  },
  {
    question: "What makes answers trustworthy?",
    answer:
      "Every answer cites its sources. When Lightfast says 'the authentication system uses JWT tokens,' it shows you the exact PR, document, or discussion where that information came from. You can click through to verify, see the full context, and understand who made that decision and when. No black-box AI responses—everything is explainable and verifiable.",
  },
  {
    question: "How does pricing work?",
    answer:
      "We offer a free Starter plan for up to 3 users with 2 sources. Our Team plan is $12/user/month with semantic search and Neural Memory. Business plan includes unlimited everything with advanced features. You pay for users who can search, not for how much you search. Check our pricing page for full details.",
  },
];

export function FAQSection() {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
          {/* Left side - FAQ label */}
          <div className="md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              FAQs
            </span>
          </div>

          {/* Right side - FAQ content */}
          <div className="md:col-span-10 md:col-start-3">
            {/* Header with CTA */}
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-8 pb-8 border-b border-border">
              <div className="space-y-1">
                <p className="text-xl text-muted-foreground">
                  Learn how Lightfast works.
                </p>
              </div>

              <div className="mt-6 lg:mt-0 lg:text-right">
                <p className="text-sm text-muted-foreground mb-2">
                  Ready to get started?
                </p>
                <Link
                  href="/early-access"
                  className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:text-muted-foreground transition-colors group"
                >
                  Join early access
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>

            {/* FAQ Accordion */}
            <Accordion
              type="single"
              collapsible
              className="w-full"
              defaultValue="item-0"
            >
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="border-b border-border last:border-b-0"
                >
                  <AccordionTrigger
                    className={cn(
                      "flex justify-between items-center w-full py-6 text-left",
                      "hover:no-underline group",
                    )}
                  >
                    <span className="text-base font-medium text-foreground pr-4">
                      {faq.question}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-6 pr-12">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {faq.answer}
                    </p>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
  );
}