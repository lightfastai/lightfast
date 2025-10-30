---
title: Operations and SLOs
description: Availability and latency budgets, backpressure and aging
status: working
owner: platform-ops
audience: engineering
last_updated: 2025-10-30
tags: [slo, ops]
---

# Operations and SLOs

Last Updated: 2025-10-30

- SLOs: 99% availability for read paths; p95 latency budgets per endpoint.
- Backpressure: queue depth and concurrency caps for embedding/index jobs.
- Aging: nightly consolidation to summaries; rebuild profiles; prune low-importance tails.

See: ../architecture/spec.md §10 for full context.
