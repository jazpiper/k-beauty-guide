create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('reviewer', 'ingredient_editor', 'safety_rule_admin', 'super_admin')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brands (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  slug text not null unique,
  country text not null default 'KR',
  official_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default extensions.gen_random_uuid(),
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
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  source_type text not null check (source_type in ('brand_official', 'commerce', 'partner_feed', 'manual')),
  base_url text,
  crawl_strategy text not null check (crawl_strategy in ('sitemap', 'html_list', 'json_api', 'rss', 'manual_upload')),
  allowed_paths text[] not null default '{}',
  blocked_paths text[] not null default '{}',
  robots_policy_notes text,
  rate_limit_per_minute integer not null default 6 check (rate_limit_per_minute >= 0),
  min_delay_ms integer not null default 5000 check (min_delay_ms >= 0),
  max_pages_per_run integer not null default 20 check (max_pages_per_run >= 0),
  user_agent_label text not null default 'k-beauty-guide-crawler',
  pause_on_statuses integer[] not null default array[403, 429],
  pause_on_challenge boolean not null default true,
  snapshot_retention_days integer not null default 30 check (snapshot_retention_days between 7 and 90),
  enabled boolean not null default false,
  last_checked_at timestamptz,
  paused_at timestamptz,
  pause_reason text,
  paused_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  storage_path text,
  source_url text,
  alt_text text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.product_sources (
  id uuid primary key default extensions.gen_random_uuid(),
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
  id uuid primary key default extensions.gen_random_uuid(),
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
  id uuid primary key default extensions.gen_random_uuid(),
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  language text not null check (language in ('ko', 'en', 'inci', 'cas', 'synonym')),
  source text not null default 'seed',
  confidence numeric not null default 1 check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique (normalized_alias, language)
);

create table public.product_ingredients (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id),
  raw_name text not null,
  matched_name text,
  position integer not null,
  match_method text not null check (match_method in ('exact', 'normalized', 'alias', 'cas', 'manual', 'unmatched')),
  confidence numeric not null default 0 check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  unique (product_id, position)
);

create table public.ingredient_evidence (
  id uuid primary key default extensions.gen_random_uuid(),
  ingredient_id uuid references public.ingredients(id) on delete cascade,
  source_name text not null,
  source_url text,
  source_region text check (source_region in ('KR', 'EU', 'US', 'global')),
  source_type text not null check (source_type in ('regulatory', 'association_dictionary', 'scientific_review', 'internal_rule')),
  source_date date,
  claim_type text not null,
  excerpt_summary text not null,
  importer_version text not null default 'seed-v1',
  created_at timestamptz not null default now()
);

create table public.ingredient_safety_rules (
  id uuid primary key default extensions.gen_random_uuid(),
  ingredient_id uuid references public.ingredients(id) on delete cascade,
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
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  parser_version text not null,
  rule_version text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  triggered_by text not null check (triggered_by in ('product_update', 'alias_change', 'rule_change', 'evidence_update', 'manual', 'import')),
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
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id),
  rule_id uuid not null references public.ingredient_safety_rules(id),
  rule_version integer not null,
  rule_snapshot jsonb,
  analysis_run_id uuid not null references public.safety_analysis_runs(id) on delete cascade,
  severity text not null check (severity in ('info', 'caution', 'avoid_if_sensitive', 'restricted')),
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
  id uuid primary key default extensions.gen_random_uuid(),
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
  id uuid primary key default extensions.gen_random_uuid(),
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
  id uuid primary key default extensions.gen_random_uuid(),
  source_id uuid not null references public.ingestion_sources(id),
  snapshot_id uuid references public.raw_product_snapshots(id),
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
  confidence_score numeric not null default 0 check (confidence_score between 0 and 1),
  status text not null default 'new' check (status in ('new', 'reviewing', 'approved', 'rejected', 'merged')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.candidate_embeddings (
  id uuid primary key default extensions.gen_random_uuid(),
  candidate_id uuid references public.product_candidates(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  embedding_model text not null,
  embedding extensions.vector(384),
  embedding_text text not null,
  input_hash text not null,
  created_at timestamptz not null default now(),
  constraint candidate_embeddings_one_target check (
    (candidate_id is not null and product_id is null)
    or (candidate_id is null and product_id is not null)
  ),
  unique (embedding_model, input_hash)
);

create table public.duplicate_suggestions (
  id uuid primary key default extensions.gen_random_uuid(),
  candidate_id uuid not null references public.product_candidates(id) on delete cascade,
  matched_product_id uuid references public.products(id),
  matched_candidate_id uuid references public.product_candidates(id),
  similarity_score numeric not null check (similarity_score between 0 and 1),
  reason_codes text[] not null default '{}',
  source text not null check (source in ('deterministic', 'embedding', 'llm_assisted', 'manual')),
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected', 'stale')),
  created_at timestamptz not null default now(),
  constraint duplicate_suggestions_has_match check (
    matched_product_id is not null or matched_candidate_id is not null
  )
);

create table public.prompt_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  task_type text not null,
  version text not null,
  prompt_hash text not null,
  description text not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (task_type, version)
);

create table public.ai_assessment_runs (
  id uuid primary key default extensions.gen_random_uuid(),
  target_type text not null check (target_type in ('product_candidate', 'ingredient_text', 'duplicate_suggestion', 'product')),
  target_id uuid not null,
  task_type text not null check (task_type in ('duplicate_check', 'field_repair', 'ingredient_cleanup', 'category_classification', 'claim_extraction')),
  model_provider text not null,
  model_name text not null,
  prompt_version text,
  input_hash text not null,
  input_summary text,
  output_json jsonb not null default '{}'::jsonb,
  confidence numeric check (confidence between 0 and 1),
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed', 'skipped')),
  latency_ms integer,
  estimated_cost_usd numeric,
  error_message text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table public.field_extraction_suggestions (
  id uuid primary key default extensions.gen_random_uuid(),
  candidate_id uuid not null references public.product_candidates(id) on delete cascade,
  field_name text not null,
  current_value jsonb,
  suggested_value jsonb not null,
  source text not null check (source in ('parser', 'embedding', 'llm', 'manual')),
  confidence numeric not null check (confidence between 0 and 1),
  ai_run_id uuid references public.ai_assessment_runs(id),
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected', 'stale')),
  created_at timestamptz not null default now()
);

create table public.review_items (
  id uuid primary key default extensions.gen_random_uuid(),
  item_type text not null check (item_type in ('product_candidate', 'product_update', 'ingredient_match', 'safety_rule_change', 'restricted_signal', 'evidence_update', 'copy_review', 'ingestion_alert')),
  item_id uuid not null,
  title text not null,
  status text not null default 'open' check (status in ('open', 'assigned', 'approved', 'rejected', 'blocked')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to uuid references auth.users(id),
  reason text not null,
  reason_codes text[] not null default '{}',
  source_id uuid references public.ingestion_sources(id),
  source_name_snapshot text,
  confidence_score numeric check (confidence_score between 0 and 1),
  requires_second_review boolean not null default false,
  second_review_status text not null default 'not_required' check (second_review_status in ('not_required', 'pending', 'approved', 'rejected')),
  second_reviewer_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.admin_audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  action text not null,
  object_type text not null,
  object_id uuid,
  previous_value jsonb,
  new_value jsonb,
  comment text,
  created_at timestamptz not null default now()
);

create index brands_name_idx on public.brands(name);
create index products_brand_category_status_idx on public.products(brand_id, category, status);
create index products_status_published_idx on public.products(status, published_at desc);
create index product_images_product_idx on public.product_images(product_id, position);
create index product_sources_product_idx on public.product_sources(product_id);
create unique index product_sources_source_product_idx
  on public.product_sources(ingestion_source_id, source_product_id)
  where source_product_id is not null;
create index ingestion_sources_enabled_idx on public.ingestion_sources(enabled, source_type);
create index ingredients_inci_name_idx on public.ingredients(inci_name);
create index ingredients_function_tags_idx on public.ingredients using gin(function_tags);
create index ingredients_benefit_tags_idx on public.ingredients using gin(benefit_tags);
create index ingredient_aliases_ingredient_idx on public.ingredient_aliases(ingredient_id);
create index product_ingredients_product_idx on public.product_ingredients(product_id, position);
create index product_ingredients_ingredient_idx on public.product_ingredients(ingredient_id);
create index ingredient_evidence_ingredient_claim_idx on public.ingredient_evidence(ingredient_id, claim_type);
create index ingredient_safety_rules_type_idx on public.ingredient_safety_rules(rule_type, active);
create index ingredient_safety_rules_ingredient_idx on public.ingredient_safety_rules(ingredient_id, active);
create index ingredient_safety_rules_condition_idx on public.ingredient_safety_rules using gin(condition);
create index safety_analysis_runs_product_idx on public.safety_analysis_runs(product_id, created_at desc);
create index safety_analysis_runs_due_idx on public.safety_analysis_runs(status, next_run_at);
create index safety_analysis_runs_lock_idx on public.safety_analysis_runs(status, locked_until);
create index product_safety_flags_product_idx on public.product_safety_flags(product_id, severity);
create index product_safety_flags_ingredient_idx on public.product_safety_flags(ingredient_id, severity);
create index product_safety_flags_run_idx on public.product_safety_flags(analysis_run_id);
create index crawl_tasks_status_idx on public.crawl_tasks(status, next_run_at);
create index crawl_tasks_lock_idx on public.crawl_tasks(status, locked_until);
create index crawl_tasks_source_idx on public.crawl_tasks(source_id, created_at desc);
create index raw_product_snapshots_hash_idx on public.raw_product_snapshots(content_hash);
create index raw_product_snapshots_source_idx on public.raw_product_snapshots(source_id, fetched_at desc);
create index product_candidates_status_idx on public.product_candidates(status, confidence_score);
create index product_candidates_source_idx on public.product_candidates(source_id, created_at desc);
create index candidate_embeddings_candidate_idx on public.candidate_embeddings(candidate_id);
create index candidate_embeddings_product_idx on public.candidate_embeddings(product_id);
create index duplicate_suggestions_candidate_idx on public.duplicate_suggestions(candidate_id, status);
create index duplicate_suggestions_similarity_idx on public.duplicate_suggestions(similarity_score desc);
create index ai_assessment_runs_target_idx on public.ai_assessment_runs(target_type, target_id, created_at desc);
create index ai_assessment_runs_task_idx on public.ai_assessment_runs(task_type, status, created_at);
create index field_extraction_suggestions_candidate_idx on public.field_extraction_suggestions(candidate_id, status);
create index review_items_status_idx on public.review_items(status, item_type, created_at);
create index review_items_source_idx on public.review_items(source_id, status);
create index admin_audit_logs_object_idx on public.admin_audit_logs(object_type, object_id, created_at desc);

create trigger admin_users_set_updated_at before update on public.admin_users
  for each row execute function public.set_updated_at();
create trigger brands_set_updated_at before update on public.brands
  for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();
create trigger ingestion_sources_set_updated_at before update on public.ingestion_sources
  for each row execute function public.set_updated_at();
create trigger ingredients_set_updated_at before update on public.ingredients
  for each row execute function public.set_updated_at();
create trigger ingredient_safety_rules_set_updated_at before update on public.ingredient_safety_rules
  for each row execute function public.set_updated_at();
create trigger product_candidates_set_updated_at before update on public.product_candidates
  for each row execute function public.set_updated_at();

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
set search_path = public, extensions
as $$
begin
  if p_worker_id is null or btrim(p_worker_id) = '' then
    raise exception 'worker id is required';
  end if;

  return query
  with selected as (
    select ct.id
    from public.crawl_tasks ct
    join public.ingestion_sources src on src.id = ct.source_id
    where (
      (ct.status = 'queued' and coalesce(ct.next_run_at, now()) <= now())
      or (ct.status = 'running' and ct.locked_until < now())
    )
    and src.enabled = true
    and src.paused_at is null
    and (src.paused_until is null or src.paused_until <= now())
    and (p_source_id is null or ct.source_id = p_source_id)
    and (p_task_types is null or ct.task_type = any(p_task_types))
    order by ct.created_at
    limit least(greatest(coalesce(p_limit, 10), 1), 25)
    for update of ct skip locked
  ),
  updated as (
    update public.crawl_tasks ct
    set status = 'running',
        claimed_by = p_worker_id,
        lease_token = extensions.gen_random_uuid(),
        locked_until = now() + (least(greatest(coalesce(p_lease_seconds, 300), 1), 900) * interval '1 second'),
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
  set status = case
        when p_status = 'failed' and p_retry_after is not null then 'queued'
        else p_status
      end,
      next_run_at = case
        when p_status = 'failed' and p_retry_after is not null then p_retry_after
        else ct.next_run_at
      end,
      claimed_by = null,
      lease_token = null,
      locked_until = null,
      finished_at = case
        when p_status = 'failed' and p_retry_after is not null then null
        else now()
      end,
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

create or replace function public.claim_safety_analysis_run(
  p_analysis_run_id uuid,
  p_worker_id text,
  p_lease_seconds integer default 300
)
returns public.safety_analysis_runs
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_run public.safety_analysis_runs;
begin
  update public.safety_analysis_runs sar
  set status = 'running',
      claimed_by = p_worker_id,
      lease_token = extensions.gen_random_uuid(),
      locked_until = now() + (least(greatest(coalesce(p_lease_seconds, 300), 1), 900) * interval '1 second'),
      attempt_count = sar.attempt_count + 1,
      error_code = null,
      error_message = null
  where sar.id = p_analysis_run_id
  and (
    (sar.status = 'queued' and coalesce(sar.next_run_at, now()) <= now())
    or (sar.status = 'running' and sar.locked_until < now())
  )
  returning * into v_run;

  if not found then
    raise exception 'safety analysis run is not claimable';
  end if;

  return v_run;
end;
$$;

create or replace function public.complete_safety_analysis_run(
  p_analysis_run_id uuid,
  p_lease_token uuid,
  p_status text,
  p_flag_count integer default 0,
  p_retry_after timestamptz default null,
  p_error_code text default null,
  p_error_message text default null
)
returns public.safety_analysis_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run public.safety_analysis_runs;
begin
  if p_status not in ('succeeded', 'failed') then
    raise exception 'invalid safety analysis completion status';
  end if;

  update public.safety_analysis_runs sar
  set status = case
        when p_status = 'failed' and p_retry_after is not null then 'queued'
        else p_status
      end,
      next_run_at = case
        when p_status = 'failed' and p_retry_after is not null then p_retry_after
        else sar.next_run_at
      end,
      claimed_by = null,
      lease_token = null,
      locked_until = null,
      flag_count = case when p_status = 'succeeded' then greatest(coalesce(p_flag_count, 0), 0) else sar.flag_count end,
      error_code = p_error_code,
      error_message = p_error_message,
      finished_at = case
        when p_status = 'failed' and p_retry_after is not null then null
        else now()
      end
  where sar.id = p_analysis_run_id
  and sar.lease_token = p_lease_token
  and sar.status = 'running'
  returning * into v_run;

  if not found then
    raise exception 'safety analysis lease is stale or missing';
  end if;

  return v_run;
end;
$$;

revoke all on function public.claim_due_crawl_tasks(text, uuid, text[], integer, integer) from public, anon, authenticated;
revoke all on function public.complete_crawl_task(uuid, uuid, text, timestamptz, text, text) from public, anon, authenticated;
revoke all on function public.claim_safety_analysis_run(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.complete_safety_analysis_run(uuid, uuid, text, integer, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.claim_due_crawl_tasks(text, uuid, text[], integer, integer) to service_role;
grant execute on function public.complete_crawl_task(uuid, uuid, text, timestamptz, text, text) to service_role;
grant execute on function public.claim_safety_analysis_run(uuid, text, integer) to service_role;
grant execute on function public.complete_safety_analysis_run(uuid, uuid, text, integer, timestamptz, text, text) to service_role;
