export const PITCH_SLIDES = [
  // Slide 1: Title (unchanged)
  {
    id: "title",
    type: "title" as const,
    title: "LIGHTFAST",
    subtitle: "Pitch deck 2026 —",
    bgColor: "bg-[var(--pitch-deck-red)]",
  },
  // Slide 2: Intro (updated content)
  {
    id: "intro",
    type: "content" as const,
    title: "Hi, we are Lightfast.",
    gridTitle: "Introduction",
    leftText: "THE MEMORY LAYER FOR ENGINEERING TEAMS",
    rightText: [
      "Any engineer or AI agent can ask 'what broke?', 'who owns this?', or 'why was this decision made?'—and get accurate answers with sources.",
      "We connect GitHub, Vercel, and your engineering tools to create searchable memory across your entire org.",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 3: Problem (more specific with $ impact)
  {
    id: "problem",
    type: "content" as const,
    title: "The Problem.",
    gridTitle: "Problem",
    leftText: "CONTEXT IS SCATTERED",
    rightText: [
      "Engineers spend 30% of their time searching for context—costing companies $40K+/engineer/year",
      "Knowledge lives across 8+ tools—each with its own search that doesn't understand meaning",
      "When engineers leave, their understanding of 'why' walks out with them",
      "AI coding assistants hallucinate because they can't access your team's history",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 4: Solution (concrete and outcome-focused)
  {
    id: "solution",
    type: "content" as const,
    title: "Our Solution.",
    gridTitle: "Solution",
    leftText: "A UNIFIED MEMORY LAYER",
    rightText: [
      "Connect GitHub, Vercel, and docs in 5 minutes with OAuth—no configuration files",
      "Semantic search understands 'authentication flow changes' not just 'auth'",
      "Every answer cites its source—PR, commit, discussion, or document",
      "MCP tools let AI agents access your team's memory natively",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 5: Unique Insight (NEW - most important for pre-revenue)
  {
    id: "insight",
    type: "content" as const,
    title: "Our Insight.",
    gridTitle: "Insight",
    leftText: "THE NON-OBVIOUS TRUTH",
    rightText: [
      "Vector search alone gives 60-70% precision—too noisy for engineers to trust",
      "We add a second 'key': LLM validation of relevance after vector retrieval",
      "Two-key retrieval achieves 90%+ precision—answers worth trusting",
      "Plus: multi-view embeddings, entity extraction, and contributor context",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 6: Why Now (columns layout - market timing)
  {
    id: "why-now",
    type: "columns" as const,
    title: "Why Now.",
    gridTitle: "Why Now",
    columns: [
      {
        header: "AI CAPABILITY",
        items: ["Foundation models crossed 80%+ SWE-bench in 2025"],
      },
      {
        header: "INFRASTRUCTURE",
        items: [
          "Vector databases production-ready",
          "Pinecone, Weaviate at scale",
        ],
      },
      {
        header: "PROTOCOL",
        items: ["MCP creating standard for AI agent context access"],
      },
      {
        header: "ADOPTION",
        items: ["Enterprise AI assistants", "14% → 90% by 2028"],
      },
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 7: Team (placeholder for specific accomplishments)
  {
    id: "team",
    type: "content" as const,
    title: "The Team.",
    gridTitle: "Team",
    leftText: "WHY US FOR THIS",
    rightText: [
      "[Name]: Built search at [Company], served X queries/day",
      "[Name]: Led ML infra at [Company], scaled to Y scale",
      "Together: [Specific relevant accomplishment showing founder-market fit]",
      "Advisors: [Notable names if any]",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 8: Validation (renamed from Traction - qualitative signals)
  {
    id: "validation",
    type: "content" as const,
    title: "Validation.",
    gridTitle: "Validation",
    leftText: "WHY WE'RE BUILDING THIS",
    rightText: [
      "We lived this problem—spent years watching context evaporate across teams",
      "Interviewed 15+ engineering leads—100% said context loss is top-3 pain",
      "Existing solutions (Sourcegraph, Confluence) rated 'inadequate' by 80%",
      "AI agent builders specifically asking for memory layer access",
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 9: Ask (showcase layout - key fundraising metrics)
  {
    id: "ask",
    type: "showcase" as const,
    title: "Building the memory layer for engineering teams.",
    metadata: [
      { label: "RAISING", value: "$300K PRE-SEED" },
      { label: "RUNWAY", value: "12 MONTHS" },
      { label: "MILESTONE", value: "Q2 2026 BETA" },
      { label: "TARGET", value: "$5K MRR" },
    ],
    bgColor: "bg-[#F5F5F0]",
    textColor: "text-foreground",
  },
  // Slide 10: Vision / Contact (custom closing slide)
  {
    id: "vision",
    type: "title" as const,
    title: "Every team deserves a memory layer.",
    subtitle: "jp@lightfast.ai",
    bgColor: "bg-[#F5F5F0]",
  },
] as const;
