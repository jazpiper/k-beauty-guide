# Remaining Work Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` for implementation phases with independent slices, or `superpowers:executing-plans` for sequential execution. This document is the current handoff source for remaining work order and verification.

**Goal:** Finish the MVP path by expanding backend verification, implementing product media/description ingestion, wiring admin review, and preparing staging release.

**Architecture:** Keep Supabase as the backend system of record, Vercel/CRA as the public app, and `crawler/` as a source-agnostic ingestion module. Crawler output remains review-first: raw snapshots and candidates stay private, and only reviewed normalized data reaches public product surfaces.

**Tech Stack:** React 18 CRA, Supabase Postgres/RLS/Edge Functions, Supabase CLI local stack, Docker Desktop or compatible Docker runtime, Node smoke scripts.

---

## Current Baseline

- Local frontend build/test can be verified through Docker when host Node/CRA is unreliable.
- `npm run smoke:supabase:local` starts Supabase local, resets DB, runs analyzer smoke, and cleans up the stack.
- Supabase schema, RLS, seed data, public views/RPC, analyzer function, crawler lease functions, admin shell functions, and crawler connector shells exist.
- Remaining backend work should preserve the current safety model: no service role key in browser code, no raw snapshot exposure in public APIs, and no auto-publish from crawler output.

## Phase 1: Backend Verification Expansion

**Purpose:** Make the local Supabase smoke command prove that all critical Edge Functions boot and enforce their minimum contracts.

**Implementation focus:**

- Add smoke coverage for `claim-crawl-tasks`, `complete-crawl-task`, `admin-review-action`, `run-safety-analysis`, and `run-ai-quality`.
- Extend `npm run smoke:supabase:local` so it runs analyzer smoke plus the new function smoke checks after DB reset.
- For crawler lease smoke, use seeded crawl task data and validate that a claimed lease can be completed only with the matching lease token.
- For admin/internal shell functions, validate expected success or validation-error responses without requiring real production mutations.

**Success criteria:**

- `npm run smoke:supabase:local` verifies DB reset, analyzer, crawler lease flow, and admin/internal function boot/validation.
- The smoke runner remains cross-platform. Mac/Linux use the current repo path; Windows path mirroring remains a compatibility fallback only.
- Supabase output does not print local secret keys in normal smoke logs.

## Phase 2: Product Media and Description Ingestion

**Purpose:** Turn product image and description collection from a plan into fixture-tested crawler candidate output.

**Implementation focus:**

- Use existing crawler core files for media extraction, text extraction, media validation, confidence scoring, dedupe hints, and review payload creation.
- Extract image candidates from official structured data first: JSON-LD `Product.image`, Shopify product JSON images, Open Graph image, then product-gallery hints.
- Extract description candidates from official structured data and product detail copy while preserving source evidence, JSON path or selector, confidence, and review reason.
- Store official image URLs only during MVP. Do not download, rehost, or transform product images until source terms and usage rights are reviewed.
- Ensure generated candidates do not auto-publish; they must flow into review payloads.

**Success criteria:**

- Fixture-based crawler tests produce image candidates, description candidates, confidence scores, and review payloads.
- Ambiguous, low-confidence, unstable, or non-official media/description candidates are sent to review rather than public product tables.
- Product media/description behavior is documented in the crawler README or relevant architecture doc after implementation.

## Phase 3: Admin Review Workflow

**Purpose:** Make the admin review console the controlled gate between crawler candidates and public catalog data.

**Implementation focus:**

- Connect `admin-review-action` to real DB mutation and audit logging for approve, reject, block, and assign.
- Support review of product candidates, media candidates, and description candidates using the same review item model where possible.
- On approval, update normalized public-facing product fields or related product media/source records only from reviewed candidate data.
- Keep raw snapshots private and link them only as internal evidence for admins.

**Success criteria:**

- Approved reviewed data updates public product surfaces.
- Rejected or blocked candidates do not affect public data.
- Every admin decision writes an audit log with actor, action, target, idempotency key, and comment where required.

## Phase 4: Crawler Runtime Wiring

**Purpose:** Connect crawler task leasing, snapshot storage, parser execution, candidate writing, and task completion into a local end-to-end runtime.

**Implementation focus:**

- Wire task claiming through `claim-crawl-tasks`, run parser logic for seeded or fixture-backed tasks, write snapshots/candidates/review items, then complete tasks through `complete-crawl-task`.
- Keep live crawling gated by source policy, allowed/blocked paths, robots/terms/rate-limit checks, and pause rules.
- Keep browser automation and commerce/account/search/filter pages out of MVP crawling.
- Treat source dry runs as staging-only until a specific source has been reviewed for robots, terms, and rate limits.

**Success criteria:**

- Seeded or fixture-backed crawl tasks run end-to-end locally.
- Failed or invalid leases do not mutate tasks.
- Live source crawling remains disabled until explicit staging dry-run approval.

## Phase 5: Staging and Release Readiness

**Purpose:** Move from local MVP confidence to staging deploy confidence without weakening safety controls.

**Implementation focus:**

- Link Supabase staging and run migrations through the Supabase CLI.
- Deploy Edge Functions to staging and run smoke checks against staging URLs.
- Link Vercel preview and verify public pages with Supabase-backed data.
- Run release-gate checks: frontend build/test, Supabase smoke, Edge Function smoke, secret scan, admin review access, and public raw-data exposure check.

**Success criteria:**

- Vercel preview loads public pages from Supabase data.
- Edge Function smoke passes against staging.
- Secret scan reports no service role key reference in browser code.
- Raw snapshots and unreviewed candidates are not visible in public app/API responses.

## Verification Commands

Use these after documentation-only changes:

```bash
git diff --check
```

Use these after implementation phases:

```bash
npm run smoke:supabase:local
docker build -t k-beauty-guide .
docker run --rm k-beauty-guide npm run build
docker run --rm k-beauty-guide npm test -- --watchAll=false --runInBand
```

## Defaults and Assumptions

- Verification work comes before new ingestion behavior.
- Product media and description ingestion comes before admin mutation wiring.
- Admin review remains the publishing gate for crawler-derived data.
- Mac/Windows parity matters. Windows-specific Docker bind-mount caveats should stay labeled as compatibility notes, not the default developer path.
- MVP image handling stores official image URLs only; image rehosting is a later rights-reviewed phase.
