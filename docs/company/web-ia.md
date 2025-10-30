---
title: Website IA (www.lightfast.ai)
description: Top-level site information architecture for www
status: working
owner: marketing
audience: internal
last_updated: 2025-10-28
tags: [website]
---

# Website IA (www.lightfast.ai)

Last Updated: 2025-10-28

Positioning: Lead with Engineering and Products. Research signals are integrated into deep technical write‑ups and product narratives rather than a separate top‑level.

Scope (now): www.lightfast.ai only. Other properties (cloud, docs, status) will be specified later.

## Top‑level navigation

- Engineering
- Products
- Company (About, Careers, Press, Contact)
- Legal (Terms, Privacy)

## Information architecture (first pass)

- Engineering
  - `/engineering` — Engineering home (systems, infra, product engineering)
  - `/engineering/blog` — Engineering blog (deep dives, postmortems)
  - `/engineering/open-source` — OSS projects and libraries
  - `/engineering/security` — Security and reliability practices

- Products
  - `/products` — Overview of the Lightfast platform
  - `/products/cloud` — Cloud offering overview
  - `/products/api` — Public API and SDK overview
  - `/pricing` — Pricing and tiers
  - `/security` — Security, compliance, and data handling (marketing)
  - `/changelog` — Product changes and release highlights

- Company
  - `/about` — Mission, vision, leadership
  - `/careers` — Open roles
  - `/press` — Press kit and coverage
  - `/contact` — Contact and sales

- Legal
  - `/legal/terms` — Terms of Service
  - `/legal/privacy` — Privacy Policy

## SEO and sitemap (design intent)

- Only www is in scope for now; generate a sitemap that lists the above public pages when implemented.
- Avoid indexing work‑in‑progress sections until content is ready; prefer staged rollout (e.g., publish Engineering and core Product pages incrementally).

## Future web properties (out of scope for now)

- cloud.lightfast.ai — product app; index only public landing/legal, noindex authenticated.
- docs.lightfast.ai — developer docs; indexable.
- status.lightfast.ai — status page (external provider); indexable.
