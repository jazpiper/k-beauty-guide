# Crawler Module

This folder contains source-agnostic crawler contracts and source-specific
connectors for K-Beauty Guide. The module is intentionally separate from the
current CRA build; do not import these TypeScript files from `src/` until the
runtime wiring is designed.

## MVP Connectors

- `manual-import`: accepts stored manual-upload snapshots and returns product
  candidates through the same review pipeline.
- `sitemap-only`: discovers sitemap targets and, in a later parser pass, turns
  stored sitemap snapshots into product URL candidates.

Planned next connector:

- `shopify-official`: intended MVP connector after a source-specific robots,
  terms, and rate-limit dry run. It is not implemented in this folder yet.

## Connector Contract

A connector may:

- Return discovery targets from source metadata, such as a sitemap URL derived
  from `sourceBaseUrl`.
- Parse a `RawSnapshot` that core has already fetched and stored.
- Return `DiscoveredUrl[]` or a `ProductCandidate`.
- Provide a default `SourceCrawlPolicy` for administrator review.

A connector must not:

- Perform live network requests.
- Read robots.txt directly.
- Decide rate limits, retry timing, pause state, or allowed/blocked paths.
- Store raw HTML/JSON or write product records directly.
- Auto-publish crawler output.

## Core Boundary

The core fetcher layer owns the operational controls before any network request
is made:

- source policy loading
- `paused_at` / `paused_until` checks
- rate limit and minimum-delay enforcement
- latest robots policy checks through the same limiter
- allowed path and blocked path checks
- HTTP fetch, timeout, redirect, and retry behavior
- raw snapshot storage and content hash recording
- parser runner, deterministic dedupe, confidence scoring, and review queue
  writing

The intended runtime order is:

```text
source policy -> pause check -> rate limiter -> robots check -> path check
  -> core fetcher -> snapshot store -> connector parser -> review pipeline
```

## Safety Rules

- Do not crawl checkout, cart, account, order, search, filter, or sort paths.
- Store raw snapshots before parsing.
- Pause sources on 403, 429, captcha, or challenge signals.
- Treat `confidenceScore` as an internal review-priority signal, not a publish
  decision.
- Keep browser automation and commerce live crawling out of the MVP crawler
  module.
