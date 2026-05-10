# K-Beauty Guide MVP Implementation Plan

> 문서 성격: 실행 계획 아카이브. 현재 상태의 source of truth는 `PLANNING.md`, `docs/README.md`, `docs/api/01-api-contract.md`, `docs/architecture/06-mvp-backend-decisions.md`를 우선한다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current CRA prototype into a Supabase-backed MVP with real product/ingredient data flow, explainable ingredient safety reports, admin review, and a modular crawler foundation.

**Architecture:** Keep the public React app deployable on Vercel while moving domain data and automation state into Supabase. Public reads use Supabase RLS-protected views/RPCs; admin and worker mutations go through Edge Functions/RPCs with audit logs. The first implementation should preserve a local static-data fallback so UI work can continue before every Supabase piece is ready.

**Tech Stack:** React 18, CRA, React Router, Supabase JS, Supabase Postgres/Auth/Storage/Edge Functions/Cron/Queues, plain CSS, Jest/React Testing Library from `react-scripts`.

---

## Scope Check

This plan covers the MVP as a sequence of independent implementation slices. It should not be executed as one giant PR. Each task should produce a working checkpoint and can be assigned to a separate worker when the owned files do not overlap.

MVP order:

1. Frontend routing and static data separation.
2. Supabase project scaffolding, migrations, and seed data.
3. Public catalog and ingredient API client.
4. Ingredient parser and safety rule engine.
5. Admin review console MVP.
6. Modular ingestion/crawler foundation.
7. Deployment and verification.

## File Structure Map

Create or modify these files during implementation.

```text
src/
  App.js
  routes/AppRoutes.js
  components/Navbar.js
  data/products.js
  data/ingredients.js
  lib/supabaseClient.js
  api/productsApi.js
  api/ingredientsApi.js
  api/adminApi.js
  hooks/useProducts.js
  hooks/useIngredients.js
  safety/normalizeIngredientText.js
  safety/matchIngredients.js
  safety/runSafetyRules.js
  pages/Home.js
  pages/Products.js
  pages/ProductDetail.js
  pages/Ingredients.js
  pages/AdminReview.js

supabase/
  migrations/0001_core_schema.sql
  migrations/0002_public_views_and_rls.sql
  seed.sql
  functions/analyze-ingredient-text/index.ts
  functions/admin-review-action/index.ts
  functions/run-safety-analysis/index.ts
  functions/run-ai-quality/index.ts

crawler/
  core/types.ts
  core/confidenceScorer.ts
  core/dedupe.ts
  connectors/manual-import/index.ts
  connectors/sitemap-only/index.ts
```

## Task 1: Frontend Routing and Static Data Extraction

**Files:**

- Modify: `package.json`
- Modify: `src/App.js`
- Modify: `src/components/Navbar.js`
- Create: `src/routes/AppRoutes.js`
- Create: `src/data/products.js`
- Create: `src/data/ingredients.js`
- Modify: `src/pages/Home.js`
- Modify: `src/pages/Products.js`
- Create: `src/pages/ProductDetail.js`
- Modify: `src/pages/Ingredients.js`

- [ ] **Step 1: Install routing dependency**

Run:

```bash
npm install react-router-dom@6
```

Expected:

```text
npm prints a package installation summary and exits with code 0.
```

- [ ] **Step 2: Create product data module**

Create `src/data/products.js`:

```js
export const products = [
  {
    id: "cosrx-snail-96-mucin-power-essence",
    slug: "cosrx-snail-96-mucin-power-essence",
    name: "COSRX Snail 96 Mucin Power Essence",
    brand: "COSRX",
    tag: "Bestseller",
    price: "₩18,000",
    skin: "All Skin",
    category: "Serum",
    color: "#FFE4EC",
    emoji: "🐌",
    rating: 4.9,
    reviews: 12400,
    ingredientText: "Snail Secretion Filtrate, Betaine, Butylene Glycol, 1,2-Hexanediol, Sodium Hyaluronate",
    description: "A lightweight essence focused on hydration and barrier support.",
  },
  {
    id: "laneige-lip-sleeping-mask",
    slug: "laneige-lip-sleeping-mask",
    name: "Laneige Lip Sleeping Mask",
    brand: "Laneige",
    tag: "K-Icon",
    price: "₩22,000",
    skin: "Dry Lips",
    category: "Moisturizer",
    color: "#FFD6E7",
    emoji: "💋",
    rating: 4.8,
    reviews: 9800,
    ingredientText: "Diisostearyl Malate, Hydrogenated Polyisobutene, Phytosteryl/Isostearyl/Cetyl/Stearyl/Behenyl Dimer Dilinoleate, Fragrance",
    description: "A rich overnight lip mask with fragrance disclosure.",
  },
];

export const categories = ["All", "Toner", "Serum", "Moisturizer", "Cleanser", "Sunscreen", "Eye Cream"];
export const skinTypes = ["All Skin", "Dry", "Oily", "Sensitive", "Combination", "Mature"];
```

- [ ] **Step 3: Create ingredient data module**

Create `src/data/ingredients.js`:

```js
export const ingredients = [
  {
    id: "hyaluronic-acid",
    canonicalName: "Hyaluronic Acid",
    koreanName: "히알루론산",
    aliases: ["Hyaluronic Acid", "Sodium Hyaluronate", "히알루론산"],
    safety: "info",
    benefit: "Hydration",
    definition: "A humectant commonly used for hydration support.",
    functionTags: ["humectant"],
    benefitTags: ["hydration", "plumping"],
  },
  {
    id: "fragrance",
    canonicalName: "Fragrance",
    koreanName: "향료",
    aliases: ["Fragrance", "Parfum", "Aroma", "향료"],
    safety: "avoid_if_sensitive",
    benefit: "Scent",
    definition: "A generic fragrance disclosure. Users with fragrance sensitivity may want to check the label carefully.",
    functionTags: ["fragrance"],
    benefitTags: [],
  },
];

export const ingredientBenefits = ["All", "Hydration", "Brightening", "Soothing", "Anti-aging", "Acne Care", "Barrier", "Exfoliation", "Repair", "Antioxidant", "Healing", "Scent"];
```

- [ ] **Step 4: Add React Router shell**

Create `src/routes/AppRoutes.js`:

```js
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "../pages/Home";
import Products from "../pages/Products";
import ProductDetail from "../pages/ProductDetail";
import Ingredients from "../pages/Ingredients";
import ShoppingMap from "../pages/ShoppingMap";
import SkinQuiz from "../pages/SkinQuiz";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/products" element={<Products />} />
      <Route path="/products/:slug" element={<ProductDetail />} />
      <Route path="/ingredients" element={<Ingredients />} />
      <Route path="/shopping-map" element={<ShoppingMap />} />
      <Route path="/skin-quiz" element={<SkinQuiz />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 5: Replace `App.js` state router**

Modify `src/App.js`:

```js
import { BrowserRouter } from "react-router-dom";
import Navbar from "./components/Navbar";
import AppRoutes from "./routes/AppRoutes";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Navbar />
        <main>
          <AppRoutes />
        </main>
      </div>
    </BrowserRouter>
  );
}
```

- [ ] **Step 6: Update Navbar to use links**

Modify `src/components/Navbar.js`:

```js
import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import "./Navbar.css";

const NAV_LINKS = [
  { label: "Home", icon: "🏠", to: "/" },
  { label: "Products", icon: "🛍️", to: "/products" },
  { label: "Ingredients", icon: "🔬", to: "/ingredients" },
  { label: "Shopping Map", icon: "🗺️", to: "/shopping-map" },
  { label: "Skin Quiz", icon: "💆", to: "/skin-quiz" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="navbar">
      <Link className="logo" to="/" onClick={() => setMenuOpen(false)}>
        <span>🌸</span>
        <span className="logo-text">K-Beauty Guide</span>
      </Link>
      <div className={`nav-links ${menuOpen ? "open" : ""}`}>
        {NAV_LINKS.map((n) => (
          <NavLink
            key={n.label}
            to={n.to}
            onClick={() => setMenuOpen(false)}
            className={({ isActive }) => `nav-btn ${isActive ? "active" : ""}`}
          >
            {n.icon} {n.label}
          </NavLink>
        ))}
      </div>
      <div className="nav-right">
        <button className="lang-btn">🌍 EN</button>
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 7: Update Home to use router navigation**

Modify the top of `src/pages/Home.js`:

```js
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";
```

Modify the component declaration and add navigation helpers before the existing `return`:

```js
export default function Home() {
  const navigate = useNavigate();
  const [searchVal, setSearchVal] = useState("");
  const [liked, setLiked] = useState({});
  const toggleLike = (i) => setLiked((p) => ({ ...p, [i]: !p[i] }));

  const goToProducts = () => navigate("/products");
  const goToIngredients = () => navigate("/ingredients");
  const goToQuiz = () => navigate("/skin-quiz");

  // Existing return JSX continues here.
```

Replace old `setActivePage` event handlers with these calls:

```jsx
<span key={tag} className="tag" onClick={goToIngredients}>{tag}</span>
<button key={c.label} className="category-btn" onClick={goToProducts}>
<button className="view-all" onClick={goToProducts}>View All →</button>
<button className="banner-btn" onClick={goToQuiz}>Start Quiz →</button>
```

- [ ] **Step 8: Update Products to use shared data and detail links**

Modify the imports and constants in `src/pages/Products.js`:

```js
import { useState } from "react";
import { Link } from "react-router-dom";
import { categories as CATEGORIES, products as ALL_PRODUCTS, skinTypes as SKIN_TYPES } from "../data/products";
import "./Products.css";
```

Remove the local `ALL_PRODUCTS`, `CATEGORIES`, and `SKIN_TYPES` declarations. Then change the product card key and detail button:

```jsx
{filtered.map((p) => (
  <div key={p.slug} className="product-card">
    <div className="product-img" style={{ background: p.color }}>
      <span className="product-emoji">{p.emoji}</span>
      <span className="product-tag">{p.tag}</span>
      <button onClick={() => toggleLike(p.slug)} className="like-btn">{liked[p.slug] ? "❤️" : "🤍"}</button>
    </div>
    <div className="product-info">
      <div className="product-brand">{p.brand}</div>
      <div className="product-name">{p.name}</div>
      <div className="product-rating">
        {"⭐".repeat(Math.floor(p.rating))} <span>{p.rating} ({p.reviews.toLocaleString()})</span>
      </div>
      <div className="product-meta">
        <span className="skin-badge">👤 {p.skin}</span>
        <span className="price">{p.price}</span>
      </div>
      <Link className="detail-btn" to={`/products/${p.slug}`}>View Details</Link>
    </div>
  </div>
))}
```

- [ ] **Step 9: Create ProductDetail page**

Create `src/pages/ProductDetail.js`:

```js
import { Link, useParams } from "react-router-dom";
import { products } from "../data/products";
import "./Products.css";

export default function ProductDetail() {
  const { slug } = useParams();
  const product = products.find((item) => item.slug === slug);

  if (!product) {
    return (
      <div className="products-page">
        <div className="products-hero">
          <h1>Product not found</h1>
          <Link className="detail-btn" to="/products">Back to products</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="products-page">
      <div className="products-hero">
        <h1>{product.emoji} {product.name}</h1>
        <p>{product.description}</p>
      </div>
      <div className="products-body">
        <div className="products-main">
          <div className="product-card">
            <div className="product-img" style={{ background: product.color }}>
              <span className="product-emoji">{product.emoji}</span>
              <span className="product-tag">{product.tag}</span>
            </div>
            <div className="product-info">
              <div className="product-brand">{product.brand}</div>
              <div className="product-name">{product.name}</div>
              <div className="product-meta">
                <span className="skin-badge">👤 {product.skin}</span>
                <span className="price">{product.price}</span>
              </div>
              <p>{product.ingredientText}</p>
              <Link className="detail-btn" to="/ingredients">Analyze ingredients</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Run frontend smoke test**

Run:

```bash
CI=true npm test -- --watch=false --passWithNoTests
npm run build
```

Expected:

```text
All discovered test suites pass.
Compiled successfully.
```

- [ ] **Step 11: Commit Task 1**

```bash
git add package.json package-lock.json src/App.js src/components/Navbar.js src/routes/AppRoutes.js src/data/products.js src/data/ingredients.js src/pages/Home.js src/pages/Products.js src/pages/ProductDetail.js src/pages/Ingredients.js
git commit -m "feat: add routing and shared static data"
```

## Task 2: Supabase Schema, RLS, and Seed Data

**Files:**

- Create: `supabase/migrations/0001_core_schema.sql`
- Create: `supabase/migrations/0002_public_views_and_rls.sql`
- Create: `supabase/seed.sql`
- Create: `supabase/config.toml`
- Create: `.env.example`

- [ ] **Step 1: Create environment example**

Create `.env.example`:

```bash
REACT_APP_SUPABASE_URL=https://example.supabase.co
REACT_APP_SUPABASE_ANON_KEY=replace-with-anon-key
```

- [ ] **Step 2: Create local Supabase config**

Create `supabase/config.toml`:

```toml
project_id = "k-beauty-guide-local"

[api]
enabled = true
port = 54321
schemas = ["public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
major_version = 15

[studio]
enabled = true
port = 54323

[storage]
enabled = true
file_size_limit = "50MiB"
```

- [ ] **Step 3: Create core schema migration**

Create `supabase/migrations/0001_core_schema.sql` with the MVP subset:

```sql
create extension if not exists "pgcrypto";
create extension if not exists "vector";

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country text default 'KR',
  official_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id),
  name text not null,
  slug text not null unique,
  category text,
  description text,
  price_krw integer,
  currency text not null default 'KRW',
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  primary_image_url text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ingestion_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null check (source_type in ('brand_official', 'commerce', 'partner_feed', 'manual')),
  base_url text,
  crawl_strategy text not null check (crawl_strategy in ('sitemap', 'html_list', 'json_api', 'rss', 'manual_upload')),
  allowed_paths text[] not null default '{}',
  blocked_paths text[] not null default '{}',
  robots_policy_notes text,
  rate_limit_per_minute integer not null default 6,
  min_delay_ms integer not null default 5000,
  max_pages_per_run integer not null default 20,
  user_agent_label text not null default 'k-beauty-guide-crawler',
  pause_on_statuses integer[] not null default array[403, 429],
  pause_on_challenge boolean not null default true,
  snapshot_retention_days integer not null default 30,
  enabled boolean not null default false,
  last_checked_at timestamptz,
  paused_at timestamptz,
  pause_reason text,
  paused_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text not null,
  source_url text,
  alt_text text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.product_sources (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  ingestion_source_id uuid references public.ingestion_sources(id),
  source_product_id text,
  source_url text not null,
  source_price numeric,
  source_currency text,
  price_krw_conversion jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null unique,
  inci_name text,
  korean_name text,
  cas_number text,
  definition text not null default '',
  function_tags text[] not null default '{}',
  benefit_tags text[] not null default '{}',
  source_status text not null default 'manual_review' check (source_status in ('verified', 'imported', 'manual_review')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ingredient_aliases (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  language text not null,
  source text not null default 'seed',
  confidence numeric not null default 1,
  created_at timestamptz not null default now(),
  unique (normalized_alias, language)
);

create table public.product_ingredients (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id),
  raw_name text not null,
  matched_name text,
  position integer not null,
  match_method text not null check (match_method in ('exact', 'normalized', 'alias', 'cas', 'manual', 'unmatched')),
  confidence numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, position)
);

create table public.ingredient_evidence (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid references public.ingredients(id),
  source_name text not null,
  source_url text,
  source_region text,
  source_type text not null,
  source_date date,
  claim_type text not null,
  excerpt_summary text not null,
  importer_version text not null default 'seed-v1',
  created_at timestamptz not null default now()
);

create table public.ingredient_safety_rules (
  id uuid primary key default gen_random_uuid(),
  ingredient_id uuid references public.ingredients(id),
  rule_type text not null,
  severity text not null check (severity in ('info', 'caution', 'avoid_if_sensitive', 'restricted')),
  condition jsonb not null default '{}'::jsonb,
  title text not null,
  why_it_matters text not null,
  who_should_care text not null,
  recommendation text not null,
  evidence_id uuid references public.ingredient_evidence(id),
  version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.safety_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  parser_version text not null,
  rule_version text not null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  triggered_by text not null,
  attempt_count integer not null default 0,
  next_run_at timestamptz,
  claimed_by text,
  lease_token uuid,
  locked_until timestamptz,
  flag_count integer not null default 0,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.product_safety_flags (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id),
  rule_id uuid not null references public.ingredient_safety_rules(id),
  rule_version integer not null,
  rule_snapshot jsonb,
  analysis_run_id uuid not null references public.safety_analysis_runs(id),
  severity text not null,
  title text not null,
  why_it_matters text not null,
  who_should_care text not null,
  recommendation text not null,
  source_label text,
  source_region text check (source_region in ('KR', 'EU', 'US', 'global')),
  source_url text,
  generated_at timestamptz not null default now()
);

create table public.crawl_tasks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.ingestion_sources(id),
  task_type text not null check (task_type in ('discover_product_urls', 'fetch_product_detail', 'refresh_existing_product')),
  target_url text,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'needs_review')),
  attempt_count integer not null default 0,
  next_run_at timestamptz,
  claimed_by text,
  lease_token uuid,
  locked_until timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create table public.raw_product_snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.ingestion_sources(id),
  crawl_task_id uuid references public.crawl_tasks(id),
  target_url text not null,
  content_type text not null check (content_type in ('html', 'json', 'text', 'image')),
  storage_path text not null,
  content_hash text not null,
  http_status integer,
  parser_version text,
  fetched_at timestamptz not null default now()
);

create table public.product_candidates (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.ingestion_sources(id),
  snapshot_id uuid not null references public.raw_product_snapshots(id),
  source_product_id text,
  source_url text not null,
  brand_name text,
  product_name text not null,
  category text,
  source_price numeric,
  source_currency text,
  price_krw integer,
  image_urls text[] not null default '{}',
  description text,
  claims text[] not null default '{}',
  ingredient_text_raw text,
  confidence_score numeric not null default 0,
  status text not null default 'new' check (status in ('new', 'reviewing', 'approved', 'rejected', 'merged')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidate_embeddings (
  candidate_id uuid primary key references public.product_candidates(id) on delete cascade,
  embedding vector(384),
  embedding_model text not null,
  created_at timestamptz not null default now()
);

create table public.duplicate_suggestions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.product_candidates(id) on delete cascade,
  matched_product_id uuid references public.products(id),
  matched_candidate_id uuid references public.product_candidates(id),
  confidence numeric not null,
  reason_code text not null,
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_key text not null,
  version text not null,
  purpose text not null,
  created_at timestamptz not null default now(),
  unique (prompt_key, version)
);

create table public.ai_assessment_runs (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.product_candidates(id),
  prompt_version_id uuid references public.prompt_versions(id),
  model_name text not null,
  input_hash text not null,
  output_json jsonb not null default '{}'::jsonb,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.field_extraction_suggestions (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.product_candidates(id) on delete cascade,
  field_name text not null,
  suggested_value jsonb not null,
  confidence numeric not null,
  source_run_id uuid references public.ai_assessment_runs(id),
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.review_items (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('product_candidate', 'product_update', 'ingredient_match', 'safety_rule_change', 'restricted_signal', 'evidence_update', 'copy_review', 'ingestion_alert')),
  item_id uuid not null,
  title text not null,
  status text not null default 'open' check (status in ('open', 'assigned', 'approved', 'rejected', 'blocked')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  reason text not null,
  reason_codes text[] not null default '{}',
  source_id uuid references public.ingestion_sources(id),
  source_name_snapshot text,
  assigned_to uuid,
  confidence_score numeric,
  requires_second_review boolean not null default false,
  second_review_status text not null default 'not_required' check (second_review_status in ('not_required', 'pending', 'approved', 'rejected')),
  second_reviewer_id uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  action text not null,
  object_type text not null,
  object_id uuid,
  previous_value jsonb,
  new_value jsonb,
  comment text,
  created_at timestamptz not null default now()
);

create index products_status_published_idx on public.products(status, published_at desc);
create index product_sources_product_idx on public.product_sources(product_id);
create index ingestion_sources_enabled_idx on public.ingestion_sources(enabled, source_type);
create index ingredients_name_idx on public.ingredients(canonical_name);
create index ingredient_aliases_lookup_idx on public.ingredient_aliases(normalized_alias, language);
create index product_ingredients_product_idx on public.product_ingredients(product_id, position);
create index product_safety_flags_product_idx on public.product_safety_flags(product_id, severity);
create index safety_analysis_runs_due_idx on public.safety_analysis_runs(status, next_run_at);
create index safety_analysis_runs_lock_idx on public.safety_analysis_runs(status, locked_until);
create index crawl_tasks_status_idx on public.crawl_tasks(status, next_run_at);
create index crawl_tasks_lock_idx on public.crawl_tasks(status, locked_until);
create index product_candidates_status_idx on public.product_candidates(status, created_at desc);
create index review_items_status_idx on public.review_items(status, priority, created_at);
create index review_items_source_idx on public.review_items(source_id, status);
```

- [ ] **Step 3b: Add atomic crawl task lease RPCs**

Add the queue lease RPCs to the same core schema migration. Edge Functions call these RPCs; workers must not emulate claim/complete with separate select/update calls.

```sql
create or replace function public.claim_due_crawl_tasks(
  p_worker_id text,
  p_source_id uuid default null,
  p_task_types text[] default null,
  p_limit integer default 10,
  p_lease_seconds integer default 300
)
returns table (
  id uuid,
  source_id uuid,
  task_type text,
  target_url text,
  status text,
  attempt_count integer,
  next_run_at timestamptz,
  lease_token uuid,
  locked_until timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with selected as (
    select ct.id
    from public.crawl_tasks ct
    where (
      (ct.status = 'queued' and coalesce(ct.next_run_at, now()) <= now())
      or (ct.status = 'running' and ct.locked_until < now())
    )
    and (p_source_id is null or ct.source_id = p_source_id)
    and (p_task_types is null or ct.task_type = any(p_task_types))
    order by ct.created_at
    limit least(greatest(p_limit, 1), 25)
    for update skip locked
  ),
  updated as (
    update public.crawl_tasks ct
    set status = 'running',
        claimed_by = p_worker_id,
        lease_token = gen_random_uuid(),
        locked_until = now() + make_interval(secs => least(coalesce(p_lease_seconds, 300), 900)),
        started_at = coalesce(ct.started_at, now()),
        attempt_count = ct.attempt_count + 1,
        error_code = null,
        error_message = null
    from selected
    where ct.id = selected.id
    returning ct.id, ct.source_id, ct.task_type, ct.target_url, ct.status, ct.attempt_count, ct.next_run_at, ct.lease_token, ct.locked_until
  )
  select * from updated;
end;
$$;

create or replace function public.complete_crawl_task(
  p_task_id uuid,
  p_lease_token uuid,
  p_status text,
  p_retry_after timestamptz default null,
  p_error_code text default null,
  p_error_message text default null
)
returns public.crawl_tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.crawl_tasks;
begin
  if p_status not in ('succeeded', 'failed', 'needs_review') then
    raise exception 'invalid crawl task completion status';
  end if;

  update public.crawl_tasks ct
  set status = case when p_status = 'failed' and p_retry_after is not null then 'queued' else p_status end,
      next_run_at = case when p_status = 'failed' and p_retry_after is not null then p_retry_after else ct.next_run_at end,
      claimed_by = null,
      lease_token = null,
      locked_until = null,
      finished_at = case when p_status = 'failed' and p_retry_after is not null then null else now() end,
      error_code = p_error_code,
      error_message = p_error_message
  where ct.id = p_task_id
  and ct.lease_token = p_lease_token
  and ct.status = 'running'
  returning * into v_task;

  if not found then
    raise exception 'crawl task lease is stale or missing';
  end if;

  return v_task;
end;
$$;

revoke all on function public.claim_due_crawl_tasks(text, uuid, text[], integer, integer) from public, anon, authenticated;
revoke all on function public.complete_crawl_task(uuid, uuid, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.claim_due_crawl_tasks(text, uuid, text[], integer, integer) to service_role;
grant execute on function public.complete_crawl_task(uuid, uuid, text, timestamptz, text, text) to service_role;
```

- [ ] **Step 4: Create public views and RLS migration**

Create `supabase/migrations/0002_public_views_and_rls.sql`:

```sql
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_sources enable row level security;
alter table public.ingredients enable row level security;
alter table public.ingredient_aliases enable row level security;
alter table public.product_ingredients enable row level security;
alter table public.product_safety_flags enable row level security;
alter table public.ingredient_evidence enable row level security;
alter table public.ingredient_safety_rules enable row level security;
alter table public.safety_analysis_runs enable row level security;
alter table public.ingestion_sources enable row level security;
alter table public.crawl_tasks enable row level security;
alter table public.raw_product_snapshots enable row level security;
alter table public.product_candidates enable row level security;
alter table public.candidate_embeddings enable row level security;
alter table public.duplicate_suggestions enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.ai_assessment_runs enable row level security;
alter table public.field_extraction_suggestions enable row level security;
alter table public.review_items enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "public can read published products"
  on public.products for select
  using (status = 'published');

create policy "public can read brands"
  on public.brands for select
  using (true);

create policy "public can read images for published products"
  on public.product_images for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_images.product_id
      and p.status = 'published'
    )
  );

create policy "public can read sources for published products"
  on public.product_sources for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_sources.product_id
      and p.status = 'published'
    )
  );

create policy "public can read verified ingredients"
  on public.ingredients for select
  using (source_status in ('verified', 'imported'));

create policy "public can read public ingredient aliases"
  on public.ingredient_aliases for select
  using (
    exists (
      select 1 from public.ingredients i
      where i.id = ingredient_aliases.ingredient_id
      and i.source_status in ('verified', 'imported')
    )
  );

revoke all on public.ingredient_aliases from anon, authenticated;
grant select (
  ingredient_id,
  alias,
  normalized_alias,
  language
) on public.ingredient_aliases to anon, authenticated;

create policy "public can read product ingredients for published products"
  on public.product_ingredients for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_ingredients.product_id
      and p.status = 'published'
    )
  );

-- Raw product ingredient parser fields are internal.
revoke all on public.product_ingredients from anon, authenticated;
grant select (
  product_id,
  ingredient_id,
  position
) on public.product_ingredients to anon, authenticated;

create policy "public can read safety flags for published products"
  on public.product_safety_flags for select
  using (
    exists (
      select 1 from public.products p
      where p.id = product_safety_flags.product_id
      and p.status = 'published'
    )
  );

-- Keep safety flag audit columns service/admin-only even when published rows are readable.
revoke all on public.product_safety_flags from anon, authenticated;
grant select (
  id,
  product_id,
  ingredient_id,
  severity,
  title,
  why_it_matters,
  who_should_care,
  recommendation,
  source_label,
  source_region,
  source_url,
  generated_at
) on public.product_safety_flags to anon, authenticated;

-- Admin console raw access goes through service-role Edge Functions/RPC checks.
-- Do not query raw audit columns from the authenticated browser client.

create or replace view public.v_public_products
with (security_invoker = true) as
select
  p.id,
  p.slug,
  p.name,
  p.category,
  p.price_krw,
  p.currency,
  p.primary_image_url,
  p.published_at,
  b.id as brand_id,
  b.name as brand_name,
  b.slug as brand_slug,
  (
    select psf.severity
    from public.product_safety_flags psf
    where psf.product_id = p.id
    and psf.analysis_run_id = latest_sar.id
    order by case psf.severity
      when 'restricted' then 4
      when 'avoid_if_sensitive' then 3
      when 'caution' then 2
      when 'info' then 1
      else 0
    end desc
    limit 1
  ) as highest_severity,
  (
    select count(*)
    from public.product_safety_flags psf
    where psf.product_id = p.id
    and psf.analysis_run_id = latest_sar.id
  )::integer as flag_count
from public.products p
join public.brands b on b.id = p.brand_id
left join lateral (
  select sar.id
  from public.safety_analysis_runs sar
  where sar.product_id = p.id
  and sar.status = 'succeeded'
  order by sar.finished_at desc nulls last, sar.created_at desc
  limit 1
) latest_sar on true
where p.status = 'published'
;

-- This sanitized view intentionally aggregates active safety-rule counts.
-- It does not expose raw rule rows, evidence rows, or internal rule IDs.
create or replace view public.v_public_ingredients as
select
  i.id,
  i.canonical_name,
  i.inci_name,
  i.korean_name,
  i.definition,
  i.function_tags,
  i.benefit_tags,
  (
    select count(*)
    from public.ingredient_safety_rules r
    where r.ingredient_id = i.id
    and r.active = true
  )::integer as safety_signal_count
from public.ingredients i
where i.source_status in ('verified', 'imported');

create or replace view public.v_public_product_safety_flags
with (security_invoker = true) as
select
  psf.id,
  psf.product_id,
  psf.ingredient_id,
  i.canonical_name as ingredient_name,
  psf.severity,
  psf.title,
  psf.why_it_matters,
  psf.who_should_care,
  psf.recommendation,
  psf.source_label,
  psf.source_region,
  psf.source_url,
  psf.generated_at
from public.product_safety_flags psf
join public.products p on p.id = psf.product_id
left join public.ingredients i on i.id = psf.ingredient_id
where p.status = 'published';

create or replace function public.get_public_product_detail(product_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'slug', p.slug,
    'name', p.name,
    'category', p.category,
    'description', p.description,
    'priceKrw', p.price_krw,
    'currency', p.currency,
    'primaryImageUrl', p.primary_image_url,
    'images', coalesce((
      select jsonb_agg(jsonb_build_object(
        'storagePath', pi.storage_path,
        'sourceUrl', pi.source_url,
        'altText', pi.alt_text,
        'position', pi.position
      ) order by pi.position)
      from public.product_images pi
      where pi.product_id = p.id
    ), '[]'::jsonb),
    'sources', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sourceUrl', ps.source_url,
        'sourceProductId', ps.source_product_id,
        'sourcePrice', ps.source_price,
        'sourceCurrency', ps.source_currency,
        'lastSeenAt', ps.last_seen_at
      ) order by ps.last_seen_at desc nulls last)
      from public.product_sources ps
      where ps.product_id = p.id
    ), '[]'::jsonb),
    'publishedAt', p.published_at,
    'updatedAt', p.updated_at,
    'brand', jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'slug', b.slug,
      'officialUrl', b.official_url
    ),
    'ingredients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', pi.position,
        'ingredientId', pi.ingredient_id,
        'displayName', case when pi.ingredient_id is null then 'Ingredient under review' else i.canonical_name end,
        'inciName', i.inci_name,
        'koreanName', i.korean_name,
        'reviewStatus', case when pi.ingredient_id is null then 'under_review' else 'matched' end
      ) order by pi.position)
      from public.product_ingredients pi
      left join public.ingredients i on i.id = pi.ingredient_id
      where pi.product_id = p.id
    ), '[]'::jsonb),
    'safetyReport', jsonb_build_object(
      'productId', p.id,
      'generatedAt', (
        select max(psf.generated_at)
        from public.product_safety_flags psf
        where psf.product_id = p.id
      ),
      'ingredientCount', (
        select count(*)
        from public.product_ingredients pi
        where pi.product_id = p.id
      ),
      'unmatchedIngredientCount', (
        select count(*)
        from public.product_ingredients pi
        where pi.product_id = p.id
        and pi.ingredient_id is null
      ),
      'flags', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', psf.id,
          'ingredientId', psf.ingredient_id,
          'ingredientName', i.canonical_name,
          'severity', psf.severity,
          'title', psf.title,
          'whyItMatters', psf.why_it_matters,
          'whoShouldCare', psf.who_should_care,
          'recommendation', psf.recommendation,
          'sourceLabel', psf.source_label,
          'sourceRegion', psf.source_region,
          'sourceUrl', psf.source_url
        ))
        from public.product_safety_flags psf
        left join public.ingredients i on i.id = psf.ingredient_id
        where psf.product_id = p.id
      ), '[]'::jsonb)
    )
  )
  from public.products p
  join public.brands b on b.id = p.brand_id
  where p.slug = product_slug
  and p.status = 'published'
  limit 1;
$$;
```

- [ ] **Step 5: Create seed data**

Create `supabase/seed.sql`:

```sql
insert into public.brands (name, slug, country)
values ('COSRX', 'cosrx', 'KR'), ('Laneige', 'laneige', 'KR')
on conflict (slug) do nothing;

insert into public.products (brand_id, name, slug, category, description, price_krw, currency, status, primary_image_url, published_at)
select id, 'Advanced Snail 96 Mucin Power Essence', 'cosrx-advanced-snail-96-mucin-power-essence', 'Essence', 'Hydrating essence with snail secretion filtrate.', 18000, 'KRW', 'published', null, now()
from public.brands where slug = 'cosrx'
on conflict (slug) do nothing;

insert into public.products (brand_id, name, slug, category, description, price_krw, currency, status, primary_image_url, published_at)
select id, 'Water Bank Blue Hyaluronic Cream', 'laneige-water-bank-blue-hyaluronic-cream', 'Moisturizer', 'Moisturizing cream with hyaluronic acid support.', 42000, 'KRW', 'published', null, now()
from public.brands where slug = 'laneige'
on conflict (slug) do nothing;

insert into public.ingredients (canonical_name, inci_name, korean_name, definition, function_tags, benefit_tags, source_status)
values
  ('Sodium Hyaluronate', 'Sodium Hyaluronate', '히알루론산나트륨', 'A humectant used for hydration support.', array['humectant'], array['hydration'], 'verified'),
  ('Fragrance', 'Parfum', '향료', 'A generic fragrance disclosure.', array['fragrance'], array[]::text[], 'verified')
on conflict (canonical_name) do nothing;

insert into public.ingredient_aliases (ingredient_id, alias, normalized_alias, language, source, confidence)
select id, 'Sodium Hyaluronate', 'sodium hyaluronate', 'inci', 'seed', 1
from public.ingredients where canonical_name = 'Sodium Hyaluronate'
on conflict (normalized_alias, language) do nothing;

insert into public.ingredient_aliases (ingredient_id, alias, normalized_alias, language, source, confidence)
select id, 'Fragrance', 'fragrance', 'en', 'seed', 1
from public.ingredients where canonical_name = 'Fragrance'
on conflict (normalized_alias, language) do nothing;

insert into public.product_ingredients (product_id, ingredient_id, raw_name, matched_name, position, match_method, confidence)
select p.id, i.id, 'Sodium Hyaluronate', i.canonical_name, 1, 'exact', 1
from public.products p, public.ingredients i
where p.slug = 'laneige-water-bank-blue-hyaluronic-cream'
and i.canonical_name = 'Sodium Hyaluronate'
on conflict (product_id, position) do nothing;

insert into public.product_ingredients (product_id, ingredient_id, raw_name, matched_name, position, match_method, confidence)
select p.id, i.id, 'Fragrance', i.canonical_name, 2, 'exact', 1
from public.products p, public.ingredients i
where p.slug = 'laneige-water-bank-blue-hyaluronic-cream'
and i.canonical_name = 'Fragrance'
on conflict (product_id, position) do nothing;

insert into public.ingredient_evidence (ingredient_id, source_name, source_region, source_type, claim_type, excerpt_summary)
select id, 'Internal MVP seed rule', 'global', 'internal_rule', 'fragrance_allergen', 'Generic fragrance disclosure can matter for fragrance-sensitive users.'
from public.ingredients where canonical_name = 'Fragrance';

insert into public.ingredient_safety_rules (ingredient_id, rule_type, severity, title, why_it_matters, who_should_care, recommendation, evidence_id)
select i.id, 'sensitivity_signal', 'avoid_if_sensitive', 'Fragrance ingredient detected', 'Generic fragrance disclosure can matter for users with fragrance sensitivity.', 'Users with fragrance sensitivity or allergic contact dermatitis history.', 'Check the product label and patch test before use.', e.id
from public.ingredients i
join public.ingredient_evidence e on e.ingredient_id = i.id
where i.canonical_name = 'Fragrance'
and e.source_name = 'Internal MVP seed rule';
```

- [ ] **Step 6: Verify migrations locally or in staging**

Run after Supabase CLI setup:

```bash
npx supabase@latest db reset
```

Expected:

```text
Finished supabase db reset
```

- [ ] **Step 7: Commit Task 2**

```bash
git add .env.example supabase/config.toml supabase/migrations/0001_core_schema.sql supabase/migrations/0002_public_views_and_rls.sql supabase/seed.sql
git commit -m "feat: add supabase mvp schema"
```

## Task 3: Public API Client with Static Fallback

**Files:**

- Create: `src/lib/supabaseClient.js`
- Create: `src/api/productsApi.js`
- Create: `src/api/ingredientsApi.js`
- Create: `src/hooks/useProducts.js`
- Create: `src/hooks/useIngredients.js`
- Modify: `src/pages/Products.js`
- Modify: `src/pages/Ingredients.js`

- [ ] **Step 1: Install Supabase client**

Run:

```bash
npm install @supabase/supabase-js
```

Expected:

```text
npm prints a package installation summary and exits with code 0.
```

- [ ] **Step 2: Create Supabase client**

Create `src/lib/supabaseClient.js`:

```js
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
```

- [ ] **Step 3: Create products API**

Create `src/api/productsApi.js`:

```js
import { products as staticProducts } from "../data/products";
import { hasSupabaseConfig, supabase } from "../lib/supabaseClient";

function mapProductListRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand_name,
    category: row.category,
    tag: row.highest_severity ? "Review notes" : "Published",
    price: row.price_krw ? `₩${Number(row.price_krw).toLocaleString()}` : "Price pending",
    skin: "All Skin",
    color: "#FFE4EC",
    emoji: "🧴",
    rating: 0,
    reviews: 0,
    priceKrw: row.price_krw,
    currency: row.currency,
    primaryImageUrl: row.primary_image_url,
    safetySummary: {
      highestSeverity: row.highest_severity,
      flagCount: row.flag_count,
    },
  };
}

function mapProductDetail(data) {
  if (!data) return null;

  return {
    ...data,
    brand: data.brand?.name ?? data.brand ?? "Unknown brand",
    brandInfo: data.brand && typeof data.brand === "object" ? data.brand : null,
    price: data.priceKrw ? `₩${Number(data.priceKrw).toLocaleString()}` : data.price ?? "Price pending",
    skin: data.skin ?? "All Skin",
    color: data.color ?? "#FFE4EC",
    emoji: data.emoji ?? "🧴",
    rating: data.rating ?? 0,
    reviews: data.reviews ?? 0,
    images: data.images ?? [],
    sources: data.sources ?? [],
    ingredients: data.ingredients ?? [],
    safetyReport: data.safetyReport ?? { flags: [] },
    ingredientText: data.ingredientText ?? (data.ingredients ?? []).map((item) => item.displayName).filter(Boolean).join(", "),
  };
}

export async function listProducts(params = {}) {
  if (!hasSupabaseConfig) {
    return staticProducts;
  }

  let query = supabase.from("v_public_products").select("*").limit(params.limit ?? 24);

  if (params.q) {
    query = query.ilike("name", `%${params.q}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  return data.map(mapProductListRow);
}

export async function getProductBySlug(slug) {
  if (!hasSupabaseConfig) {
    return mapProductDetail(staticProducts.find((product) => product.slug === slug) ?? null);
  }

  const { data, error } = await supabase
    .rpc("get_public_product_detail", { product_slug: slug });

  if (error) throw error;
  return mapProductDetail(data);
}
```

- [ ] **Step 4: Create ingredients API**

Create `src/api/ingredientsApi.js`:

```js
import { ingredients as staticIngredients } from "../data/ingredients";
import { hasSupabaseConfig, supabase } from "../lib/supabaseClient";

function mapIngredientRow(row) {
  const functionTags = row.function_tags ?? row.functionTags ?? [];
  const benefitTags = row.benefit_tags ?? row.benefitTags ?? (row.benefit ? [row.benefit] : []);
  const canonicalName = row.canonical_name ?? row.canonicalName ?? row.name;
  const safetySignalCount = row.safety_signal_count ?? row.safetySignalCount ?? 0;

  return {
    id: row.id,
    name: canonicalName,
    canonicalName,
    inciName: row.inci_name ?? row.inciName,
    korean: row.korean_name ?? row.koreanName ?? row.korean ?? "",
    koreanName: row.korean_name ?? row.koreanName ?? row.korean,
    benefit: benefitTags[0] ?? "General",
    benefits: benefitTags,
    desc: row.definition ?? row.desc ?? "",
    definition: row.definition ?? row.desc,
    tags: row.tags ?? [...functionTags, ...benefitTags],
    aliases: row.aliases ?? [],
    safety: row.safety ?? (safetySignalCount > 0 ? "Review" : "Info"),
    safetySignalCount,
    emoji: row.emoji ?? "🧪",
    color: row.color ?? "#E8F5E9",
  };
}

export async function listIngredients(params = {}) {
  if (!hasSupabaseConfig) {
    return staticIngredients.map(mapIngredientRow);
  }

  let query = supabase.from("v_public_ingredients").select("*").limit(params.limit ?? 50);

  if (params.q) {
    query = query.ilike("canonical_name", `%${params.q}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapIngredientRow);
}
```

- [ ] **Step 5: Create products hook**

Create `src/hooks/useProducts.js`:

```js
import { useEffect, useState } from "react";
import { listProducts } from "../api/productsApi";

export function useProducts(params = {}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    listProducts(params)
      .then((items) => {
        if (!cancelled) setProducts(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.q, params.limit]);

  return { products, loading, error };
}
```

- [ ] **Step 6: Create ingredients hook**

Create `src/hooks/useIngredients.js`:

```js
import { useEffect, useState } from "react";
import { listIngredients } from "../api/ingredientsApi";

export function useIngredients(params = {}) {
  const [ingredients, setIngredients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    listIngredients(params)
      .then((items) => {
        if (!cancelled) setIngredients(items);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [params.q, params.limit]);

  return { ingredients, loading, error };
}
```

- [ ] **Step 7: Wire pages to API hooks**

Modify `src/pages/Products.js` so the product grid reads from `useProducts` instead of directly from `ALL_PRODUCTS`:

```js
import { useProducts } from "../hooks/useProducts";

// inside Products component
const { products: apiProducts, loading, error } = useProducts({ q: search });
const sourceProducts = apiProducts.length ? apiProducts : ALL_PRODUCTS;
const filtered = sourceProducts.filter((p) => {
  const matchCat = activeCategory === "All" || p.category === activeCategory;
  const matchSkin = activeSkin === "All Skin" || p.skin.includes(activeSkin);
  const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.brand.toLowerCase().includes(search.toLowerCase());
  return matchCat && matchSkin && matchSearch;
}).sort((a, b) => sortBy === "popular" ? b.reviews - a.reviews : sortBy === "rating" ? b.rating - a.rating : 0);
```

Render lightweight states before the grid:

```jsx
{loading && <div className="empty-state">Loading products...</div>}
{error && <div className="empty-state">Could not load live products. Showing fallback data.</div>}
```

Modify `src/pages/ProductDetail.js` so it uses `getProductBySlug` and handles both fallback and Supabase-normalized shapes. Replace the existing top import block, static `products` import, and `products.find(...)` block; do not keep both the static `product` variable and the hook-managed `product` state.

Use this top import block:

```js
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getProductBySlug } from "../api/productsApi";
import "./Products.css";
```

Then place the hook code inside `export default function ProductDetail()` immediately after `const { slug } = useParams()`. Do not place hooks at module scope:

```js
const [product, setProduct] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  let cancelled = false;
  getProductBySlug(slug)
    .then((item) => {
      if (!cancelled) setProduct(item);
    })
    .finally(() => {
      if (!cancelled) setLoading(false);
    });
  return () => {
    cancelled = true;
  };
}, [slug]);
```

Modify `src/pages/Ingredients.js` so the ingredient list reads from `useIngredients` and uses the normalized UI fields (`name`, `korean`, `benefit`, `desc`, `tags`, `safety`).

- [ ] **Step 8: Run build**

Run:

```bash
npm run build
```

Expected:

```text
Compiled successfully.
```

- [ ] **Step 9: Commit Task 3**

```bash
git add package.json package-lock.json src/lib/supabaseClient.js src/api/productsApi.js src/api/ingredientsApi.js src/hooks/useProducts.js src/hooks/useIngredients.js src/pages/Products.js src/pages/ProductDetail.js src/pages/Ingredients.js
git commit -m "feat: add public api client fallback"
```

## Task 4: Ingredient Parser and Safety Rule Engine

**Files:**

- Create: `src/safety/normalizeIngredientText.js`
- Create: `src/safety/matchIngredients.js`
- Create: `src/safety/runSafetyRules.js`
- Create: `src/safety/safety.test.js`
- Modify: `src/api/ingredientsApi.js`
- Modify: `src/pages/Ingredients.js`

- [ ] **Step 1: Write parser tests**

Create `src/safety/safety.test.js`:

```js
import { normalizeIngredientText, splitIngredientText } from "./normalizeIngredientText";
import { matchIngredients } from "./matchIngredients";
import { runSafetyRules } from "./runSafetyRules";

const ingredients = [
  { id: "fragrance", canonicalName: "Fragrance", aliases: ["fragrance", "parfum", "향료"] },
  { id: "sodium-hyaluronate", canonicalName: "Sodium Hyaluronate", aliases: ["sodium hyaluronate", "히알루론산나트륨"] },
];

test("splits mixed ingredient text into ordered tokens", () => {
  const normalized = normalizeIngredientText("Ingredients: Water, Sodium Hyaluronate; Fragrance");
  expect(splitIngredientText(normalized)).toEqual(["Water", "Sodium Hyaluronate", "Fragrance"]);
});

test("matches aliases case-insensitively", () => {
  const matches = matchIngredients("Water, parfum", ingredients);
  expect(matches[1]).toMatchObject({
    ingredientId: "fragrance",
    matchMethod: "alias",
  });
});

test("creates fragrance warning from matched ingredient", () => {
  const matches = matchIngredients("Water, Fragrance", ingredients);
  const flags = runSafetyRules(matches);
  expect(flags).toHaveLength(1);
  expect(flags[0].severity).toBe("avoid_if_sensitive");
});
```

- [ ] **Step 2: Verify tests fail**

Run:

```bash
npm test -- --watch=false src/safety/safety.test.js
```

Expected:

```text
Cannot find module './normalizeIngredientText'
```

- [ ] **Step 3: Implement parser**

Create `src/safety/normalizeIngredientText.js`:

```js
export function normalizeIngredientText(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/\r?\n/g, " ")
    .replace(/전성분|성분|Ingredients?:/gi, "")
    .replace(/[;；]/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitIngredientText(value) {
  return normalizeIngredientText(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
```

- [ ] **Step 4: Implement matcher**

Create `src/safety/matchIngredients.js`:

```js
import { splitIngredientText } from "./normalizeIngredientText";

function normalizeAlias(value) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function matchIngredients(ingredientText, knownIngredients) {
  const aliasMap = new Map();

  knownIngredients.forEach((ingredient) => {
    ingredient.aliases.forEach((alias) => {
      aliasMap.set(normalizeAlias(alias), ingredient);
    });
  });

  return splitIngredientText(ingredientText).map((rawName, index) => {
    const matched = aliasMap.get(normalizeAlias(rawName));

    return {
      position: index + 1,
      rawName,
      ingredientId: matched?.id ?? null,
      displayName: matched?.canonicalName ?? rawName,
      matchMethod: matched ? (normalizeAlias(matched.canonicalName) === normalizeAlias(rawName) ? "exact" : "alias") : "unmatched",
      confidence: matched ? 0.9 : 0,
    };
  });
}
```

- [ ] **Step 5: Implement safety rules**

Create `src/safety/runSafetyRules.js`:

```js
export function runSafetyRules(matches) {
  return matches
    .filter((match) => match.ingredientId === "fragrance")
    .map((match) => ({
      id: `flag-${match.position}-${match.ingredientId}`,
      ingredientId: match.ingredientId,
      ingredientName: match.displayName,
      severity: "avoid_if_sensitive",
      title: "Fragrance ingredient detected",
      whyItMatters: "Generic fragrance disclosure can matter for users with fragrance sensitivity.",
      whoShouldCare: "Users with fragrance sensitivity or allergic contact dermatitis history.",
      recommendation: "Check the product label and patch test before use.",
      sourceLabel: "Internal MVP rule",
      sourceUrl: null,
    }));
}
```

- [ ] **Step 6: Verify tests pass**

Run:

```bash
npm test -- --watch=false src/safety/safety.test.js
```

Expected:

```text
PASS src/safety/safety.test.js
```

- [ ] **Step 7: Commit Task 4**

```bash
git add src/safety src/api/ingredientsApi.js src/pages/Ingredients.js
git commit -m "feat: add ingredient parser and safety rules"
```

## Task 5: Admin Review Console MVP

**Files:**

- Create: `src/pages/AdminReview.js`
- Create: `src/pages/AdminReview.css`
- Create: `src/api/adminApi.js`
- Modify: `src/routes/AppRoutes.js`

- [ ] **Step 1: Create static admin API fallback**

Create `src/api/adminApi.js`:

```js
const demoReviewItems = [
  {
    id: "review-demo-1",
    itemType: "product_candidate",
    title: "COSRX Snail 96 Mucin Power Essence",
    status: "open",
    priority: "normal",
    reason: "New product candidate from manual import",
    confidenceScore: 0.86,
    createdAt: new Date().toISOString(),
  },
  {
    id: "review-demo-2",
    itemType: "ingredient_match",
    title: "Unknown ingredient: Parfum",
    status: "open",
    priority: "high",
    reason: "Alias confirmation required",
    confidenceScore: 0.62,
    createdAt: new Date().toISOString(),
  },
];

export async function listReviewItems() {
  return demoReviewItems;
}
```

- [ ] **Step 2: Create AdminReview page**

Create `src/pages/AdminReview.js`:

```js
import { useEffect, useState } from "react";
import { listReviewItems } from "../api/adminApi";
import "./AdminReview.css";

export default function AdminReview() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    listReviewItems().then(setItems);
  }, []);

  return (
    <div className="admin-review-page">
      <header className="admin-review-header">
        <h1>Admin Review Queue</h1>
        <p>Evidence-first review for product candidates, ingredient matches, and safety rules.</p>
      </header>
      <section className="admin-review-table">
        {items.map((item) => (
          <article key={item.id} className="admin-review-row">
            <div>
              <strong>{item.title}</strong>
              <p>{item.reason}</p>
            </div>
            <span>{item.itemType}</span>
            <span>{item.priority}</span>
            <span>{Math.round(item.confidenceScore * 100)}%</span>
          </article>
        ))}
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Create AdminReview CSS**

Create `src/pages/AdminReview.css`:

```css
.admin-review-page {
  max-width: 1120px;
  margin: 0 auto;
  padding: 32px 20px;
}

.admin-review-header {
  margin-bottom: 24px;
}

.admin-review-header h1 {
  margin: 0 0 8px;
  font-size: 28px;
}

.admin-review-header p {
  margin: 0;
  color: #666;
}

.admin-review-table {
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
}

.admin-review-row {
  display: grid;
  grid-template-columns: 1fr 160px 120px 80px;
  gap: 16px;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.admin-review-row:last-child {
  border-bottom: 0;
}

.admin-review-row p {
  margin: 4px 0 0;
  color: #777;
  font-size: 13px;
}
```

- [ ] **Step 4: Register admin route**

Modify `src/routes/AppRoutes.js`:

```js
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "../pages/Home";
import Products from "../pages/Products";
import ProductDetail from "../pages/ProductDetail";
import Ingredients from "../pages/Ingredients";
import ShoppingMap from "../pages/ShoppingMap";
import SkinQuiz from "../pages/SkinQuiz";
import AdminReview from "../pages/AdminReview";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/products" element={<Products />} />
      <Route path="/products/:slug" element={<ProductDetail />} />
      <Route path="/ingredients" element={<Ingredients />} />
      <Route path="/shopping-map" element={<ShoppingMap />} />
      <Route path="/skin-quiz" element={<SkinQuiz />} />
      <Route path="/admin/review" element={<AdminReview />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
```

- [ ] **Step 5: Verify admin route**

Run:

```bash
npm run build
```

Expected:

```text
Compiled successfully.
```

- [ ] **Step 6: Commit Task 5**

```bash
git add src/pages/AdminReview.js src/pages/AdminReview.css src/api/adminApi.js src/routes/AppRoutes.js
git commit -m "feat: add admin review queue shell"
```

## Task 6: Edge Function Contracts

**Files:**

- Create: `supabase/functions/analyze-ingredient-text/index.ts`
- Create: `supabase/functions/admin-review-action/index.ts`
- Create: `supabase/functions/run-safety-analysis/index.ts`
- Create: `supabase/functions/run-ai-quality/index.ts`
- Create: `supabase/functions/claim-crawl-tasks/index.ts`
- Create: `supabase/functions/complete-crawl-task/index.ts`

- [ ] **Step 1: Create analyze ingredient text function**

Create `supabase/functions/analyze-ingredient-text/index.ts`:

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: { code: "method_not_allowed", message: "Use POST" } }, { status: 405 });
  }

  const body = await req.json();
  const ingredientText = String(body.ingredientText ?? "").trim();

  if (!ingredientText) {
    return Response.json({ ok: false, error: { code: "validation_error", message: "ingredientText is required" } }, { status: 400 });
  }

  if (ingredientText.length > 10000) {
    return Response.json({ ok: false, error: { code: "validation_error", message: "ingredientText must be 10,000 characters or fewer" } }, { status: 400 });
  }

  return Response.json({
    ok: true,
    data: {
      parsedIngredients: ingredientText.split(",").map((rawName: string, index: number) => ({
        position: index + 1,
        rawName: rawName.trim(),
        ingredientId: null,
        displayName: rawName.trim(),
        matchMethod: "unmatched",
        confidence: 0,
      })),
      flags: [],
      unmatchedCount: ingredientText.split(",").length,
      disclaimer: "Ingredient information is educational and not a medical diagnosis.",
    },
  });
});
```

- [ ] **Step 2: Create admin review action function shell**

Create `supabase/functions/admin-review-action/index.ts`:

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: { code: "method_not_allowed", message: "Use POST" } }, { status: 405 });
  }

  const body = await req.json();
  const action = body.action;
  const idempotencyKey = body.idempotencyKey;
  const comment = String(body.comment ?? "").trim();

  if (!["approve", "reject", "block", "assign"].includes(action) || !idempotencyKey || (action === "approve" && !comment)) {
    return Response.json({ ok: false, error: { code: "validation_error", message: "Valid action, idempotencyKey, and approval comment are required" } }, { status: 400 });
  }

  return Response.json({
    ok: true,
    data: {
      accepted: true,
      action,
      reviewItemId: body.reviewItemId,
    },
  });
});
```

- [ ] **Step 3: Create safety analysis function shell**

Create `supabase/functions/run-safety-analysis/index.ts`:

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: { code: "method_not_allowed", message: "Use POST" } }, { status: 405 });
  }

  const body = await req.json();
  const analysisRunId = String(body.analysisRunId ?? "").trim();

  if (!analysisRunId) {
    return Response.json({ ok: false, error: { code: "validation_error", message: "analysisRunId is required" } }, { status: 400 });
  }

  return Response.json({
    ok: true,
    data: {
      analysisRunId,
      status: "queued",
      note: "MVP shell only. Rule execution is implemented in the safety engine task.",
    },
  });
});
```

- [ ] **Step 4: Create AI quality function shell**

Create `supabase/functions/run-ai-quality/index.ts`:

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ ok: false, error: { code: "method_not_allowed", message: "Use POST" } }, { status: 405 });
  }

  const body = await req.json();
  const candidateId = String(body.candidateId ?? "").trim();

  if (!candidateId) {
    return Response.json({ ok: false, error: { code: "validation_error", message: "candidateId is required" } }, { status: 400 });
  }

  return Response.json({
    ok: true,
    data: {
      candidateId,
      duplicateSuggestionsCreated: 0,
      fieldSuggestionsCreated: 0,
    },
  });
});
```

- [ ] **Step 5: Create crawl task lease endpoint shells**

Create `supabase/functions/claim-crawl-tasks/index.ts` and `supabase/functions/complete-crawl-task/index.ts`.

Implementation requirements:

- Use service-role access only inside the Edge Function; never expose service role keys to the browser.
- `claim-crawl-tasks` accepts `ClaimCrawlTasksRequest` from the API contract.
- Claiming must call one atomic database RPC/transaction that selects due `queued` tasks and expired `running` leases with `for update skip locked`, then sets `status = 'running'`, `claimed_by`, a fresh `lease_token`, `locked_until`, `started_at`, and `attempt_count + 1`.
- `complete-crawl-task` must validate the active `lease_token` and `status = 'running'` before writing success/failure.
- Stale or mismatched leases must return a 409-style error and must not update the task.
- Retryable failures must clear claim fields and set `status = 'queued'` with `next_run_at = retryAfter`; terminal failures keep `failed` or `needs_review`.

- [ ] **Step 6: Verify functions type shape**

Run after Supabase CLI setup:

```bash
npx supabase@latest functions serve analyze-ingredient-text --no-verify-jwt &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
sleep 5
curl --max-time 10 -fsS http://127.0.0.1:54321/functions/v1/analyze-ingredient-text \
  -H "Content-Type: application/json" \
  -d '{"ingredientText":"Water, Fragrance"}'
kill "$server_pid"
trap - EXIT
```

Expected:

The curl command returns an `ok: true` JSON response, then the background function server is stopped.

Repeat the same background serve/curl/kill pattern for:

- `claim-crawl-tasks` with `{"workerId":"local-worker","limit":1,"leaseSeconds":300}`
- `complete-crawl-task` with a fixture task id and lease token from the claim response
- `admin-review-action` with `{"action":"approve","comment":"local smoke test","idempotencyKey":"local-test","reviewItemId":"demo"}`
- `run-safety-analysis` with `{"analysisRunId":"demo"}`
- `run-ai-quality` with `{"candidateId":"demo"}`

- [ ] **Step 7: Commit Task 6**

```bash
git add supabase/functions
git commit -m "feat: add edge function contract shells"
```

## Task 7: Modular Crawler Foundation

**Files:**

- Create: `crawler/core/types.ts`
- Create: `crawler/core/confidenceScorer.ts`
- Create: `crawler/core/dedupe.ts`
- Create: `crawler/connectors/manual-import/index.ts`
- Create: `crawler/connectors/sitemap-only/index.ts`
- Create: `crawler/README.md`

Implementation guardrail:

- Do not perform live external fetches in this task.
- Build contracts and fixture-driven parser shells first.
- A later live dry run must implement this order before any network request: source policy loader, source pause/`paused_until` check, rate limiter/min delay, latest robots check through the same limiter, blocked path check, core fetcher, snapshot store, connector parser.

- [ ] **Step 1: Create crawler types**

Create `crawler/core/types.ts`:

```ts
export type CrawlContext = {
  sourceId: string;
  sourceKey: string;
  sourceBaseUrl?: string;
  now: string;
};

export type DiscoveredUrl = {
  url: string;
  sourceProductId?: string;
  lastModified?: string;
};

export type DiscoveryTarget = {
  url: string;
  taskType: "discover_product_urls";
};

export type SourceCrawlPolicy = {
  allowedPathPrefixes: string[];
  blockedPathPrefixes: string[];
  maxRequestsPerMinute: number;
  minDelayMs: number;
  maxPagesPerRun: number;
  userAgentLabel: string;
  pauseOnStatuses: number[];
  pauseOnChallenge: boolean;
  snapshotRetentionDays: number;
};

export type ConfidenceHint = {
  field: "brandName" | "productName" | "category" | "ingredientTextRaw" | "imageUrls" | "price";
  reasonCode: "missing" | "weak_match" | "conflict" | "parser_fallback";
  message: string;
};

export type RawSnapshot = {
  id: string;
  sourceId: string;
  targetUrl: string;
  contentType: "html" | "json" | "text" | "image";
  contentHash: string;
  storagePath: string;
  fetchedAt: string;
};

export type ProductCandidate = {
  sourceId: string;
  snapshotId: string;
  sourceProductId?: string;
  sourceUrl: string;
  brandName?: string;
  productName: string;
  category?: string;
  sourcePrice?: number;
  sourceCurrency?: string;
  priceKrw?: number;
  imageUrls: string[];
  description?: string;
  claims: string[];
  ingredientTextRaw?: string;
  parserVersion: string;
  confidenceHints: ConfidenceHint[];
  confidenceScore: number;
};

export type CrawlConnector = {
  sourceKey: string;
  getDiscoveryTargets(context: CrawlContext): Promise<DiscoveryTarget[]>;
  parseDiscoverySnapshot(snapshot: RawSnapshot, context: CrawlContext): Promise<DiscoveredUrl[]>;
  parseProductCandidate?(snapshot: RawSnapshot, context: CrawlContext): Promise<ProductCandidate>;
  getDefaultPolicy(): SourceCrawlPolicy;
};
```

Connectors must not perform network requests. Core fetcher applies robots checks, blocked path checks, rate limits, pause policy, snapshot storage, and retry before a connector receives `RawSnapshot`.

- [ ] **Step 2: Create confidence scorer**

Create `crawler/core/confidenceScorer.ts`:

```ts
import type { ProductCandidate } from "./types";

export function scoreCandidate(candidate: Omit<ProductCandidate, "confidenceScore">): number {
  let score = 0.35;

  if (candidate.productName) score += 0.2;
  if (candidate.brandName) score += 0.15;
  if (candidate.imageUrls.length > 0) score += 0.1;
  if (candidate.ingredientTextRaw) score += 0.15;
  if (candidate.sourceProductId) score += 0.05;

  return Math.min(1, Number(score.toFixed(2)));
}
```

- [ ] **Step 3: Create deterministic dedupe helper**

Create `crawler/core/dedupe.ts`:

```ts
import type { ProductCandidate } from "./types";

export type DuplicateSignal = {
  reasonCode: "same_source_product_id" | "same_source_url" | "same_brand_normalized_name";
  confidence: number;
};

function normalizeName(value: string | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9가-힣]+/g, " ").trim();
}

export function compareCandidates(a: ProductCandidate, b: ProductCandidate): DuplicateSignal[] {
  const signals: DuplicateSignal[] = [];

  if (a.sourceProductId && a.sourceProductId === b.sourceProductId) {
    signals.push({ reasonCode: "same_source_product_id", confidence: 0.98 });
  }

  if (a.sourceUrl === b.sourceUrl) {
    signals.push({ reasonCode: "same_source_url", confidence: 0.95 });
  }

  if (
    normalizeName(a.brandName) &&
    normalizeName(a.brandName) === normalizeName(b.brandName) &&
    normalizeName(a.productName) === normalizeName(b.productName)
  ) {
    signals.push({ reasonCode: "same_brand_normalized_name", confidence: 0.9 });
  }

  return signals;
}
```

- [ ] **Step 4: Create manual import connector shell**

Create `crawler/connectors/manual-import/index.ts`:

```ts
import { scoreCandidate } from "../../core/confidenceScorer";
import type { CrawlConnector, ProductCandidate, RawSnapshot } from "../../core/types";

export const manualImportConnector: CrawlConnector = {
  sourceKey: "manual-import",

  getDefaultPolicy() {
    return {
      allowedPathPrefixes: [],
      blockedPathPrefixes: [],
      maxRequestsPerMinute: 0,
      minDelayMs: 0,
      maxPagesPerRun: 0,
      userAgentLabel: "k-beauty-guide-manual-import",
      pauseOnStatuses: [],
      pauseOnChallenge: false,
      snapshotRetentionDays: 30,
    };
  },

  async getDiscoveryTargets() {
    return [];
  },

  async parseDiscoverySnapshot() {
    return [];
  },

  async parseProductCandidate(snapshot: RawSnapshot): Promise<ProductCandidate> {
    const candidateWithoutScore = {
      sourceId: snapshot.sourceId,
      snapshotId: snapshot.id,
      sourceUrl: snapshot.targetUrl,
      productName: "Manual import candidate",
      imageUrls: [],
      claims: [],
      parserVersion: "manual-import@0.1.0",
      confidenceHints: [],
    };

    return {
      ...candidateWithoutScore,
      confidenceScore: scoreCandidate(candidateWithoutScore),
    };
  },
};
```

- [ ] **Step 5: Create sitemap-only connector shell**

Create `crawler/connectors/sitemap-only/index.ts`:

```ts
import type { CrawlConnector, RawSnapshot } from "../../core/types";

export const sitemapOnlyConnector: CrawlConnector = {
  sourceKey: "sitemap-only",

  getDefaultPolicy() {
    return {
      allowedPathPrefixes: ["/"],
      blockedPathPrefixes: ["/cart", "/checkout", "/account", "/order", "/search"],
      maxRequestsPerMinute: 6,
      minDelayMs: 5000,
      maxPagesPerRun: 20,
      userAgentLabel: "k-beauty-guide-sitemap",
      pauseOnStatuses: [403, 429],
      pauseOnChallenge: true,
      snapshotRetentionDays: 30,
    };
  },

  async getDiscoveryTargets(context) {
    return context.sourceBaseUrl ? [{ url: `${context.sourceBaseUrl}/sitemap.xml`, taskType: "discover_product_urls" }] : [];
  },

  async parseDiscoverySnapshot(snapshot: RawSnapshot) {
    // MVP shell: real implementation reads the stored sitemap snapshot content through core snapshot-store.
    return [];
  },
};
```

- [ ] **Step 6: Add crawler README**

Create `crawler/README.md`:

````md
# Crawler Module

This folder contains source-agnostic crawler contracts and source-specific connectors.

MVP connectors:

- `manual-import`
- `sitemap-only`

Rules:

- Do not crawl checkout, cart, account, order, search, filter, or sort paths.
- Do not auto-publish crawler output.
- Store raw snapshots before parsing.
- Pause sources on 403, 429, captcha, or challenge signals.
````

- [ ] **Step 7: Commit Task 7**

```bash
git add crawler
git commit -m "feat: add modular crawler contracts"
```

## Task 8: Deployment and Verification

**Files:**

- Create: `docs/ops/01-deployment-runbook.md`

- [ ] **Step 1: Create deployment runbook**

Create `docs/ops/01-deployment-runbook.md`:

````md
# Deployment Runbook

## Environments

- Local: CRA dev server + Supabase local CLI
- Staging: Vercel preview + Supabase staging project
- Production: Vercel production + Supabase production project

## Local Verification

Run:

```bash
CI=true npm test -- --watch=false --passWithNoTests
npm run build
```

Expected:

```text
Compiled successfully.
```

## Supabase Verification

Run:

```bash
npx supabase@latest db reset
npx supabase@latest functions serve analyze-ingredient-text --no-verify-jwt &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
sleep 5
curl --max-time 10 -fsS http://127.0.0.1:54321/functions/v1/analyze-ingredient-text \
  -H "Content-Type: application/json" \
  -d '{"ingredientText":"Water, Fragrance"}'
kill "$server_pid"
trap - EXIT
```

Expected:

```text
Finished supabase db reset
{"ok":true,...}
```

## Release Gate

- Public product list loads.
- Product detail loads.
- Ingredient analyzer returns parsed rows.
- Admin review queue loads for admin user.
- No service role key is present in browser environment variables.
````

- [ ] **Step 2: Run final verification**

Run:

```bash
CI=true npm test -- --watch=false --passWithNoTests
npm run build
if rg -n "service_role|SUPABASE_SERVICE_ROLE" src public; then
  echo "Secret-like service role reference found"
  exit 1
else
  echo "No service role references found in browser code"
fi
```

Expected:

```text
All discovered test suites pass.
Compiled successfully.
```

The secret scan should print `No service role references found in browser code`.

- [ ] **Step 3: Commit Task 8**

```bash
git add docs/ops/01-deployment-runbook.md
git commit -m "docs: add deployment runbook"
```

## Execution Notes

- Use a new branch before implementing: `git checkout -b codex/mvp-implementation`.
- Keep commits scoped to one task.
- Do not introduce browser automation crawling during MVP implementation.
- Do not store user allergy-like data in Supabase until consent copy and deletion flow are implemented.
- Do not use LLM output as final safety classification.

## Self-Review Checklist

- Data model coverage: Tasks 2, 4, 5, 6, and 7 cover schema, safety, admin review, worker functions, and crawler foundation.
- API contract coverage: Tasks 3, 5, and 6 cover public, admin, and internal surfaces.
- Frontend coverage: Tasks 1, 3, 4, and 5 cover routing, product detail, ingredient analyzer, and admin shell.
- Verification coverage: Every task has a build, test, local CLI, or commit checkpoint.
- Deployment coverage: Task 8 creates the runbook and release gate.
