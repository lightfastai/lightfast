---
date: 2026-02-08
status: pending
type: research-prompt
tags: [datadog, migration, observability, betterstack, sentry]
---

# Research Prompt: Datadog Migration Strategy

## Objective

Research comprehensive migration strategy from BetterStack (Logtail) to Datadog for logging and APM, while maintaining Sentry integration for error tracking. Goal is to create a unified observability platform with better integration capabilities.

## Research Questions

### 1. Datadog Core Integration Architecture

**Primary Questions:**
- How does Datadog's APM and logging work with Next.js 15+ applications?
- What is the official Datadog SDK for Node.js and browser environments?
- How does Datadog handle both server-side (Node.js, Edge runtime) and client-side logging?
- What are the initialization patterns for Next.js instrumentation files?
- How does Datadog handle environment-based configuration (development, preview, production)?

**Search Strategy:**
```
1. "Datadog Next.js 15 integration APM logging 2026"
2. "Datadog dd-trace Node.js instrumentation setup"
3. "Datadog browser SDK RUM real user monitoring"
4. "Datadog Next.js Edge runtime support"
5. "Datadog environment configuration best practices"
```

**Key Documentation:**
- Datadog APM Node.js Tracer documentation
- Datadog Browser SDK documentation
- Datadog Next.js integration guide
- Datadog configuration reference

### 2. Datadog + Sentry Integration Patterns

**Primary Questions:**
- Can Datadog and Sentry coexist in the same application?
- What is the recommended integration pattern between Datadog APM and Sentry error tracking?
- How do you correlate Datadog traces with Sentry error events?
- Does Datadog have built-in error tracking that can replace/supplement Sentry?
- How do you prevent duplicate error reporting between Datadog and Sentry?
- What are the trade-offs of using Datadog Error Tracking vs keeping Sentry?

**Search Strategy:**
```
1. "Datadog Sentry integration error tracking APM 2026"
2. "Datadog error tracking vs Sentry comparison"
3. "correlate Datadog traces Sentry errors"
4. "Datadog APM Sentry coexist best practices"
5. "unified observability Datadog Sentry architecture"
```

**Key Considerations:**
- Trace ID correlation between systems
- Error context enrichment
- Session replay capabilities (Sentry has it, does Datadog?)
- Cost implications of running both systems
- When to use which system for what purpose

### 3. BetterStack to Datadog Migration Path

**Primary Questions:**
- What is the equivalent Datadog API to BetterStack's console-like interface?
- How do you structure logs in Datadog (similar to BetterStack's structured logging)?
- What is Datadog's approach to log levels (debug, info, warn, error)?
- How do you replace `@logtail/next` with Datadog's SDK?
- What changes are needed in the vendor abstraction layer?
- How do you maintain backward compatibility during migration?

**Search Strategy:**
```
1. "migrate BetterStack Logtail to Datadog logging"
2. "Datadog structured logging Node.js examples"
3. "Datadog logger API console interface"
4. "Datadog log levels severity best practices"
5. "Datadog Node.js tracer logger integration"
```

**Migration Considerations:**
- Minimal code changes in application layer (keep vendor abstraction)
- Environment variable mapping (Logtail → Datadog)
- Log format compatibility (structured logging patterns)
- Performance implications (Datadog batching vs Logtail)
- Cost comparison (Datadog vs BetterStack pricing)

### 4. Datadog Integration Capabilities (The "Why")

**Primary Questions:**
- What integrations does Datadog offer that BetterStack doesn't?
- How does Datadog integrate with:
  - GitHub (commits, PRs, deployments)
  - Vercel (deployments, functions, analytics)
  - Clerk (authentication events)
  - Inngest (workflow monitoring)
  - PlanetScale (database query monitoring)
  - Pinecone (vector database operations)
  - tRPC (RPC monitoring)
- What are Datadog's webhook and API capabilities?
- How does Datadog's Workflow Automation compare to existing tools?

**Search Strategy:**
```
1. "Datadog GitHub integration deployment tracking"
2. "Datadog Vercel Next.js integration 2026"
3. "Datadog custom integrations API webhooks"
4. "Datadog workflow automation use cases"
5. "Datadog PostgreSQL PlanetScale monitoring"
6. "Datadog tRPC Node.js tracing"
```

**Integration Priorities:**
- GitHub (highest - for deployment correlation)
- Vercel (highest - for Next.js performance)
- Database monitoring (PlanetScale)
- External API monitoring (Pinecone, Clerk)
- Workflow monitoring (Inngest)

### 5. Datadog APM and Distributed Tracing

**Primary Questions:**
- How does Datadog's APM differ from BetterStack's logging approach?
- What is Datadog's distributed tracing model?
- How do you trace requests across:
  - Next.js API routes
  - tRPC procedures
  - Inngest workflows
  - External API calls (Clerk, GitHub, Pinecone)
- How does Datadog handle trace context propagation?
- What are the performance implications of Datadog's instrumentation?

**Search Strategy:**
```
1. "Datadog APM distributed tracing Node.js"
2. "Datadog trace context propagation Next.js"
3. "Datadog custom spans instrumentation"
4. "Datadog tRPC tracing examples"
5. "Datadog performance overhead benchmarks"
```

**Tracing Considerations:**
- Automatic vs manual instrumentation
- Custom span creation for business logic
- Trace sampling strategies (100% vs sampled)
- Performance overhead (latency, memory)
- Trace retention and cost

### 6. Datadog Configuration and Environment Management

**Primary Questions:**
- What environment variables does Datadog require?
- How do you configure Datadog for different environments (dev, preview, prod)?
- Should development use Datadog or fall back to console.log?
- How do you configure Datadog in Next.js config vs instrumentation files?
- What is the recommended approach for Datadog API keys (server vs client)?

**Search Strategy:**
```
1. "Datadog environment configuration Next.js"
2. "Datadog API key management best practices"
3. "Datadog development vs production configuration"
4. "Datadog Next.js instrumentation file setup"
5. "Datadog webpack plugin Next.js"
```

**Configuration Considerations:**
- Server-side API key (DD_API_KEY)
- Client-side application key (DD_CLIENT_TOKEN)
- Service name and environment tagging
- Log level filtering per environment
- Cost control via sampling

### 7. Datadog Real User Monitoring (RUM)

**Primary Questions:**
- How does Datadog RUM compare to our current client-side logging with BetterStack?
- What browser events does Datadog RUM capture automatically?
- How do you add custom user actions and events?
- How does Datadog RUM integrate with Session Replay?
- Can Datadog RUM replace PostHog analytics or should they coexist?

**Search Strategy:**
```
1. "Datadog RUM Next.js React integration 2026"
2. "Datadog session replay vs Sentry session replay"
3. "Datadog RUM custom user actions"
4. "Datadog RUM PostHog comparison"
5. "Datadog browser SDK performance impact"
```

**RUM Considerations:**
- Automatic vs manual instrumentation
- Privacy controls (PII masking)
- Session replay capabilities
- Integration with APM traces
- Cost implications (session sampling)

### 8. Datadog Logs Pipeline and Processing

**Primary Questions:**
- How does Datadog process and index logs?
- What are Datadog's log pipeline processing capabilities?
- How do you create log-based metrics and alerts?
- What is Datadog's log retention and archival strategy?
- How do you query logs efficiently in Datadog?

**Search Strategy:**
```
1. "Datadog log pipeline processing rules"
2. "Datadog log-based metrics creation"
3. "Datadog log retention pricing"
4. "Datadog log query language examples"
5. "Datadog structured logging best practices"
```

**Log Pipeline Considerations:**
- Automatic JSON parsing
- Attribute extraction (requestId, userId, etc.)
- Log enrichment (add metadata)
- Sampling and filtering for cost control
- Archive to S3 for long-term retention

### 9. Migration Implementation Strategy

**Primary Questions:**
- Should we migrate incrementally (app by app) or all at once?
- How do we maintain the vendor abstraction pattern with Datadog?
- What is the rollback strategy if Datadog doesn't work as expected?
- How do we test Datadog integration before full production deployment?
- What is the timeline estimate for full migration?

**Implementation Phases:**
1. **Phase 1: Research & POC** (this prompt)
   - Research Datadog capabilities
   - Create proof-of-concept in one app (maybe chat or www)
   - Validate integration patterns
   - Estimate costs

2. **Phase 2: Vendor Package Update**
   - Update `@vendor/observability` to support Datadog
   - Create `datadog-env.ts` schema
   - Implement Datadog logger wrapper with console-compatible API
   - Test in development environment

3. **Phase 3: Incremental Rollout**
   - App 1 (lowest risk): Auth or WWW app
   - App 2: Chat app (includes AI SDK integration)
   - App 3: Console app (highest usage)
   - API/Inngest workflows

4. **Phase 4: Sentry Integration**
   - Correlate Datadog traces with Sentry errors
   - Evaluate Datadog Error Tracking vs keeping Sentry
   - Decide on final error tracking strategy

5. **Phase 5: BetterStack Deprecation**
   - Run both systems in parallel for validation period
   - Monitor cost and performance
   - Deprecate BetterStack once confident

**Rollback Considerations:**
- Keep BetterStack dependencies for quick rollback
- Feature flags for Datadog vs BetterStack
- Parallel logging during transition
- Clear success metrics for migration

### 10. Cost Analysis and ROI

**Primary Questions:**
- What is the pricing model for Datadog (APM, Logs, RUM, Error Tracking)?
- How does Datadog cost compare to BetterStack + Sentry + PostHog combined?
- What cost optimization strategies are available (sampling, retention, filtering)?
- What is the ROI of consolidating observability tools?
- Are there any hidden costs or scaling concerns?

**Search Strategy:**
```
1. "Datadog pricing calculator APM logs RUM 2026"
2. "Datadog cost optimization strategies"
3. "Datadog vs BetterStack pricing comparison"
4. "Datadog vs Sentry cost analysis"
5. "observability platform consolidation ROI"
```

**Cost Considerations:**
- Current spend: BetterStack + Sentry + PostHog
- Projected spend: Datadog all-in-one
- Engineering time savings from unified platform
- Reduced alert fatigue from correlation
- Faster incident response from integrated tools

---

## Research Output Format

For each research question, provide:

1. **Summary**: 2-3 sentence answer to the question
2. **Key Findings**: Bulleted list of important discoveries
3. **Code Examples**: If available, show implementation patterns
4. **Trade-offs**: Pros and cons of the approach
5. **Recommendations**: What to do based on findings
6. **Source Links**: Include all documentation and article URLs

---

## Codebase Context for Research

**Current State (from 2026-02-08-datadog-betterstack-sentry-logging-integration.md):**

**Vendor Abstraction Files to Update:**
- `vendor/observability/src/log.ts` - Server-side logger
- `vendor/observability/src/client-log.ts` - Client-side logger hook
- `vendor/observability/src/env/betterstack-env.ts` → `datadog-env.ts`
- `vendor/next/src/next-config-builder.ts` - Add Datadog wrapper

**Apps to Migrate:**
- `apps/console` - 17 files using BetterStack, no Sentry instrumentation
- `apps/www` - BetterStack + Sentry + PostHog
- `apps/chat` - BetterStack + Sentry + Vercel AI integration + Braintrust
- `apps/auth` - BetterStack + Sentry + Clerk error handling

**Integration Points:**
- Next.js instrumentation files (server and client)
- tRPC middleware (error tracking and tracing)
- Inngest workflows (18 workflow files)
- API routes (17+ files in console)
- React components (15+ auth components)

**Current Integrations to Maintain:**
- Sentry session replay (decide if keeping or replacing)
- PostHog analytics (decide if keeping or replacing)
- Vercel AI SDK (must work with Datadog)
- Braintrust (AI-specific logging, may keep)
- Clerk (auth error handling)

---

## Success Criteria

Research is complete when you can answer:

1. ✅ Can provide a working Datadog integration example for Next.js 15+
2. ✅ Can describe the exact Datadog + Sentry integration pattern
3. ✅ Can outline the vendor abstraction changes needed
4. ✅ Can provide a migration timeline with phases
5. ✅ Can estimate costs and ROI
6. ✅ Can identify all integration capabilities Datadog provides
7. ✅ Can recommend Datadog APM + Logs vs Datadog APM + Logs + Error Tracking vs keeping Sentry
8. ✅ Can provide rollback strategy and risk mitigation

---

## Commands to Use

```bash
# External research (web and GitHub)
/research-web [paste relevant sections above]

# External codebase analysis (look at reference implementations)
/research-codebase-external [paste relevant sections above]

# Create implementation plan after research
/create_plan [based on research findings]
```

---

## Priority Research Areas

**Phase 1 (Immediate):**
1. Datadog Next.js 15 integration architecture
2. Datadog + Sentry coexistence patterns
3. BetterStack to Datadog API mapping

**Phase 2 (After Phase 1):**
4. Datadog integration capabilities
5. Datadog APM distributed tracing
6. Datadog RUM and session replay

**Phase 3 (After Phase 2):**
7. Cost analysis and ROI
8. Migration implementation strategy
9. Vendor abstraction implementation

---

## Notes

- Focus on 2026 documentation (latest Datadog features)
- Prioritize official Datadog docs over blog posts
- Look for Next.js 15+ specific examples (not Next.js 12/13)
- Consider Vercel deployment constraints
- Check for any Datadog + Vercel specific integrations
- Evaluate if Datadog Error Tracking is mature enough to replace Sentry
- Consider that Lightfast is a B2B SaaS with compliance requirements
