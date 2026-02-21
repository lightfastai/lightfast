export const PITCH_SLIDES = [
  // Slide 1: Title
  {
    id: "title",
    type: "title" as const,
    title: "Lightfast",
    subtitle:
      "Lightfast surfaces every decision your team makes across your tools — searchable, cited, and ready for people and agents.",
    bgColor: "bg-[var(--pitch-deck-red)]",
  },
  // Slide 2: Problem
  {
    id: "problem",
    type: "content" as const,
    title: "The Problem.",
    gridTitle: "Problem",
    leftText: "THE OPERATING COST",
    rightText: [
      "AI coding agents waste 40%+ of tokens on navigation. Today the workaround is: start every session from scratch, grep and hope.",
      "Your tools don't talk to each other. An agent can't connect a Sentry error to the PR that caused it without brute-force searching across 4+ tools.",
      "92% of teams report AI agent costs higher than expected. The tokens aren't the problem. The context is.",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 3: Solution
  {
    id: "solution",
    type: "content" as const,
    title: "Our Solution.",
    gridTitle: "Solution",
    leftText: "THE CONTEXT LAYER",
    rightText: [
      "Connect GitHub, Vercel, Linear, and Sentry in 5 minutes. Every event is automatically enriched and linked across sources.",
      "Your agents get persistent context—search by meaning, not grep. 90%+ precision. Every answer cites its source.",
      "One API that sits between your tools and your agents. Works with any model. A Sentry error auto-links to the PR, the deploy, and the Linear issue—one query, full context.",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 4: Why Now
  {
    id: "why-now",
    type: "why-now" as const,
    title: "Why Now.",
    gridTitle: "Why Now",
    image: "/images/pitch-deck-anthropic-visual.png",
    imageAlt:
      "Anthropic data: Software engineering is 49.7% of all agentic tool calls",
    rightText: [
      "Agents moved from code to operations. 50% of agentic tool calls are software engineering—but emerging across every domain. Teams run agents for triage, deployment, and ticket management. The scope exploded beyond code.",
      "MCP connected agents to your tools. Before 2024, no standard existed. Now agents connect to GitHub, Sentry, Linear, Vercel natively. But connection isn't understanding.",
      "The missing layer is organizational memory. Agents have intelligence and access. What they don't have is durable, cross-tool memory of your team's decisions. This is the bottleneck—and no one has built it.",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 5: How It Works
  {
    id: "architecture",
    type: "content" as const,
    title: "How It Works.",
    gridTitle: "Architecture",
    leftText: "FROM EVENT TO DECISION",
    rightText: [
      "Every webhook event passes through a multi-stage enrichment pipeline: significance scoring → LLM classification → multi-view embedding (3 vectors per event) → entity extraction → relationship detection → actor resolution.",
      "Cross-source relationships are detected automatically—a Sentry error links to the commit that caused it, to the PR, to the Linear issue, to the deployment. 8 relationship types, zero manual tagging.",
      "Not document indexing. A knowledge graph that understands what happened, who did it, what it relates to, and why it matters. Noise is filtered; only significant decisions enter the context layer.",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 6: Insight
  {
    id: "insight",
    type: "content" as const,
    title: "Our Insight.",
    gridTitle: "Insight",
    leftText: "THE NON-OBVIOUS TRUTH",
    rightText: [
      "Vector search alone gives 60-70% precision—too noisy for engineers to trust. This is why enterprise search tools have low adoption.",
      "We add a second 'key': LLM-based semantic validation after vector retrieval. The weighted combination (60% LLM + 40% vector) achieves 90%+ precision.",
      "Multi-view embeddings (3 vectors per observation) mean queries match the right aspect of each event. Combined with cross-source relationship detection, Lightfast doesn't just find documents—it understands the web of decisions behind them.",
      "Competitors understand what code does. Lightfast understands why it was built that way.",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 7: Market Opportunity
  {
    id: "market",
    type: "columns" as const,
    title: "Market Opportunity.",
    gridTitle: "Market",
    columns: [
      {
        header: "BEACHHEAD (ALL 4 TOOLS)",
        items: [
          "14K–20K teams use GitHub + Vercel + Linear + Sentry together",
          "At $20/user/month (~$300/month per team): $180M+ ARR before expanding beyond the beachhead",
        ],
      },
      {
        header: "SAM (3+ TOOLS)",
        items: [
          "50K+ engineering teams use GitHub, Vercel, and Sentry together",
          "Vercel Marketplace Sentry integration: 50K+ installs—direct evidence of co-adoption",
        ],
      },
      {
        header: "EXPANSION",
        items: [
          "300K+ teams on any two-tool combination in engineering alone",
          "Dev tools ($24B by 2030, 27% CAGR) is the wedge. Full context infrastructure is 10x larger",
        ],
      },
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 8: Competitive Landscape
  {
    id: "competition",
    type: "content" as const,
    title: "Competitive Landscape.",
    gridTitle: "Competition",
    leftText: "WHY NOT THEM",
    rightText: [
      "AI coding tools (Cursor, Copilot, Cody): Best-in-class code generation. But limited to code-level context—they don't know why code was built or what decisions drove it. They read code. They don't read your team.",
      "Enterprise search (Glean, Notion AI): Knowledge search across documents. But no engineering-specific enrichment, no entity extraction, no cross-source relationship detection. They search documents. They don't understand connections.",
      "AI model providers (OpenAI, Anthropic): OpenAI's Memory is per-user only—zero organizational context. Anthropic is racing to own compute, not building neutral infrastructure. Both have structural incentives to increase lock-in.",
      "Lightfast: Provider-agnostic context infrastructure. One API, any AI model. The Segment for engineering context—Segment built the neutral customer data platform and was acquired for $3.2B. Context is your company's crown jewels—it shouldn't live in a model provider's system.",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 9: Business Model
  {
    id: "business-model",
    type: "columns" as const,
    title: "Business Model.",
    gridTitle: "Business Model",
    columns: [
      {
        header: "FREE",
        items: [
          "Up to 3 users. 2 integrations. Core search",
          "PLG entry—engineer connects GitHub, sees value in 5 minutes",
          "Conversion trigger: hit user limit or need team-wide search",
        ],
      },
      {
        header: "TEAM — $20/USER/MONTH",
        items: [
          "Unlimited users. All integrations. MCP tools. Advanced search",
          "Team of 15 = ~$300/month. Natural seat expansion as team grows",
          "95%+ gross margin at scale",
        ],
      },
      {
        header: "ENTERPRISE",
        items: [
          "Custom deployment. SSO/SAML. Dedicated support. SLA",
          "Teams past 100 people need enterprise features",
          "Expansion trigger: security review, compliance, multi-team rollout",
        ],
      },
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 10: Team
  {
    id: "team",
    type: "content" as const,
    title: "The Team.",
    gridTitle: "Team",
    leftText: "WHY ME",
    rightText: [
      "[Founder Name]: [Role], [specific relevant accomplishment]. [Personal narrative—raw conviction, not polished bio.]",
      "The build: 16 months. 3,930 commits. $0 external funding. One founder. Real enrichment pipeline, real search with cited sources, real MCP tools. This isn't a prototype—it's a product waiting for users.",
      "Validation: Interviewed 15+ engineering leads. 100% confirmed context loss as a top-3 pain point. I didn't research a problem—I lived it, built the solution, and now I need capital to turn it into a business.",
      "What I need beyond capital: Customer introductions to engineering teams. Hiring network for first engineering hire. Strategic guidance on enterprise sales. I built the product alone. I need a team to build the company.",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 11: Ask
  {
    id: "ask",
    type: "showcase" as const,
    title: "Every team deserves a context layer.",
    gridTitle: "The Ask",
    metadata: [
      { label: "RAISING", value: "$300K Pre-Seed" },
      {
        label: "RUNWAY",
        value: "12-18 Months (equity + R&D Tax Incentive)",
      },
      {
        label: "USE OF FUNDS",
        value:
          "60% Engineering (first hire + infrastructure), 25% GTM (design partners, Vercel Marketplace), 15% Operations",
      },
      {
        label: "MILESTONE",
        value:
          "Design partners by Month 3. Public beta by Month 6. $5K MRR by Month 12.",
      },
      { label: "CONTACT", value: "jp@lightfast.ai" },
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
] as const;
