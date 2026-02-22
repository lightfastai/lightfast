export const PITCH_SLIDES = [
  // Slide 1: Title (Sequoia: Company Purpose)
  {
    id: "title",
    type: "title" as const,
    title: "Lightfast",
    subtitle:
      "Lightfast is the memory layer for teams. Every decision across your tools — surfaced, cited, and ready for people and agents.",
    bgColor: "bg-[var(--pitch-deck-red)]",
  },
  // Slide 2: Problem (Sequoia: Problem)
  {
    id: "problem",
    type: "content" as const,
    title: "The Problem.",
    gridTitle: "Problem",
    leftText: "THE OPERATING COST",
    rightText: [
      "Your team's decisions are spread across GitHub, Linear, Sentry, Vercel — and none of them are connected.",
      "Finding what happened and why means searching each tool one by one.",
      "AI agents burn tokens navigating, not building. You're paying for search, not work.",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 3: Solution (Sequoia: Solution)
  {
    id: "solution",
    type: "content" as const,
    title: "Our Solution.",
    gridTitle: "Solution",
    leftText: "THE MEMORY LAYER",
    rightText: [
      "60+ connectors across your stack — GitHub, Vercel, Linear, Sentry, and more. Lightfast captures everything automatically.",
      "Every event is classified, linked, and cited — so you search by meaning, not by tool.",
      "People and agents get the same API. Four routes. Full context. Always cited.",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 4: Why Now (Sequoia: Why Now)
  {
    id: "why-now",
    type: "why-now" as const,
    title: "Why Now.",
    gridTitle: "Why Now",
    image: "/images/pitch-deck-anthropic-visual.png",
    imageAlt:
      "Anthropic data: Software engineering is 49.7% of all agentic tool calls",
    rightText: [
      "AI agents exploded beyond code — teams now run them for triage, deployment, and operations.",
      "MCP gave agents access to your tools. But access isn't understanding.",
      "216K stars on OpenClaw. But connecting agents to tools isn't enough — without context, they burn tokens in circles.",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 5: Market Opportunity (Sequoia: Market Size)
  {
    id: "market",
    type: "columns" as const,
    title: "Market Opportunity.",
    gridTitle: "Market",
    columns: [
      {
        header: "CUSTOMERS",
        items: [
          "Solo founders and 1–5 person teams.",
          "5–30 person high-growth startups.",
          "80K apply to YC every year — all on the same stack.",
        ],
      },
      {
        header: "MARKET SIZE",
        items: [
          "SOM: $5.8M ARR — 800 teams at $60/user/month.",
          "SAM: $TBD",
          "TAM: Every team running AI agents across disconnected tools.",
        ],
      },
      {
        header: "EXPANSION",
        items: [
          "Product & Engineering today. Revenue & Growth, Customer Experience, and Business Operations next.",
          "60+ connectors across 4 verticals.",
        ],
      },
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 6: Competitive Landscape (Sequoia: Competition)
  {
    id: "competition",
    type: "columns" as const,
    title: "Competitive Landscape.",
    gridTitle: "Competition",
    columns: [
      {
        header: "INCIDENT INTELLIGENCE",
        items: ["PagerDuty", "ResolveAI"],
      },
      {
        header: "ENTERPRISE AI SEARCH",
        items: ["Glean", "Atlassian Intelligence"],
      },
      {
        header: "AGENT MEMORY",
        items: ["Mem0", "Zep", "LangChain Memory"],
      },
      {
        header: "THE STATUS QUO",
        items: ["Grep, Slack search, and asking the one person who remembers."],
      },
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 7: Product (Sequoia: Product)
  {
    id: "product",
    type: "columns" as const,
    title: "The Product.",
    gridTitle: "Product",
    columns: [
      {
        header: "API",
        items: [
          "4 routes: search, contents, similar, answer",
          "MCP tools for any AI agent",
          "REST + SDK",
        ],
      },
      {
        header: "RETRIEVAL",
        items: [
          "Multi-view embeddings",
          "Vector + LLM reranking",
          "90%+ precision, always cited",
        ],
      },
      {
        header: "ENRICHMENT",
        items: [
          "Auto-classify, embed, extract",
          "Cross-source relationships",
          "Significance gating",
        ],
      },
      {
        header: "ROADMAP",
        items: [
          "Expand beyond engineering",
          "Slack, Zendesk, CRM connectors",
          "Agent-to-agent context passing",
        ],
      },
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 8: Business Model (Sequoia: Business Model)
  {
    id: "business-model",
    type: "columns" as const,
    title: "Business Model.",
    gridTitle: "Business Model",
    columns: [
      {
        header: "FREE",
        items: [
          "Up to 3 users",
          "2 integrations",
          "Core search",
        ],
      },
      {
        header: "TEAM — $20/USER/MONTH",
        items: [
          "Unlimited users + integrations",
          "MCP tools + advanced search",
          "95%+ gross margin at scale",
        ],
      },
      {
        header: "ENTERPRISE",
        items: [
          "Custom deployment",
          "SSO/SAML + SLA",
          "Dedicated support",
        ],
      },
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 9: Team (Sequoia: Team)
  {
    id: "team",
    type: "team" as const,
    title: "The Team.",
    gridTitle: "Team",
    founder: {
      name: "Jeevan Pillay",
      role: "Founder & CEO",
      location: "Melbourne, Australia",
      tagline:
        "Systems thinker across AI infrastructure, computational design, and material fabrication.",
    },
    tracks: [
      {
        header: "LIGHTFAST",
        items: [
          "Iterated through semantic code search, procedural AI graphics, an operating system for design tools, and an agent orchestration platform — before identifying the core problem: teams have no memory layer.",
          "Architecting ingestion pipelines, semantic retrieval with citation traceability, and evaluation loops.",
          "12 months. 3,930 commits. $0 external funding. Not a prototype.",
        ],
      },
      {
        header: "COMPUTATIONAL DESIGN",
        items: [
          "Generative algorithms, GPGPU shaders, procedural math — curl noise, Perlin fields, Voronoi tessellations.",
          "Code-to-fabrication toolchains: CNC machining, 3D printing, laser projection at scale.",
          "Led technical campaigns generating $1M+ in revenue.",
        ],
      },
      {
        header: "VALIDATION",
        items: [
          "15+ engineering lead interviews. 100% confirmed context loss as a top-3 pain point.",
          "Studied the problem through founder interviews, workflow analysis, and technical research.",
        ],
      },
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 10: The Ask (Sequoia: Financials)
  {
    id: "ask",
    type: "showcase" as const,
    title: "Every team deserves a context layer.",
    gridTitle: "The Ask",
    metadata: [
      { label: "RAISING", value: "$500K SAFE" },
      {
        label: "RUNWAY",
        value: "12-18 Months (equity + R&D Tax Incentive)",
      },
{
        label: "MILESTONE",
        value:
          "Alpha now. Public beta by Month 3. 5,000 teams on waitlist by Month 6.",
      },
      { label: "CONTACT", value: "jp@lightfast.ai" },
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
] as const;
