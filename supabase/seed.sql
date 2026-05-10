insert into public.brands (name, slug, country, official_url)
values
  ('COSRX', 'cosrx', 'KR', 'https://www.cosrx.com'),
  ('Laneige', 'laneige', 'KR', 'https://www.laneige.com')
on conflict (slug) do update
set name = excluded.name,
    country = excluded.country,
    official_url = excluded.official_url;

insert into public.ingestion_sources (
  name,
  source_type,
  base_url,
  crawl_strategy,
  allowed_paths,
  blocked_paths,
  robots_policy_notes,
  rate_limit_per_minute,
  min_delay_ms,
  max_pages_per_run,
  user_agent_label,
  pause_on_statuses,
  pause_on_challenge,
  snapshot_retention_days,
  enabled
)
values (
  'Manual Import',
  'manual',
  null,
  'manual_upload',
  '{}',
  '{}',
  'MVP seed source for local smoke tests only.',
  0,
  0,
  0,
  'k-beauty-guide-manual-import',
  '{}',
  false,
  90,
  true
)
on conflict do nothing;

insert into public.products (
  brand_id,
  name,
  slug,
  category,
  description,
  price_krw,
  currency,
  status,
  primary_image_url,
  published_at
)
select
  b.id,
  'Advanced Snail 96 Mucin Power Essence',
  'cosrx-advanced-snail-96-mucin-power-essence',
  'Essence',
  'Hydrating essence with snail secretion filtrate and humectants.',
  18000,
  'KRW',
  'published',
  null,
  now()
from public.brands b
where b.slug = 'cosrx'
on conflict (slug) do update
set brand_id = excluded.brand_id,
    category = excluded.category,
    description = excluded.description,
    price_krw = excluded.price_krw,
    currency = excluded.currency,
    status = excluded.status,
    published_at = excluded.published_at;

insert into public.products (
  brand_id,
  name,
  slug,
  category,
  description,
  price_krw,
  currency,
  status,
  primary_image_url,
  published_at
)
select
  b.id,
  'Water Bank Blue Hyaluronic Cream',
  'laneige-water-bank-blue-hyaluronic-cream',
  'Moisturizer',
  'Moisturizing cream with hyaluronic acid support and fragrance disclosure.',
  42000,
  'KRW',
  'published',
  null,
  now()
from public.brands b
where b.slug = 'laneige'
on conflict (slug) do update
set brand_id = excluded.brand_id,
    category = excluded.category,
    description = excluded.description,
    price_krw = excluded.price_krw,
    currency = excluded.currency,
    status = excluded.status,
    published_at = excluded.published_at;

insert into public.product_sources (
  product_id,
  ingestion_source_id,
  source_product_id,
  source_url,
  source_price,
  source_currency,
  last_seen_at
)
select
  p.id,
  s.id,
  p.slug,
  coalesce(s.base_url, 'manual://products') || '/' || p.slug,
  p.price_krw,
  p.currency,
  now()
from public.products p
cross join public.ingestion_sources s
where s.name = 'Manual Import'
on conflict do nothing;

insert into public.ingredients (
  canonical_name,
  inci_name,
  korean_name,
  definition,
  function_tags,
  benefit_tags,
  source_status
)
values
  (
    'Sodium Hyaluronate',
    'Sodium Hyaluronate',
    '히알루론산나트륨',
    'A humectant commonly used for hydration support.',
    array['humectant'],
    array['hydration'],
    'verified'
  ),
  (
    'Fragrance',
    'Parfum',
    '향료',
    'A generic fragrance disclosure. Users with fragrance sensitivity may want to check the label carefully.',
    array['fragrance'],
    array[]::text[],
    'verified'
  ),
  (
    'Snail Secretion Filtrate',
    'Snail Secretion Filtrate',
    '달팽이점액여과물',
    'A cosmetic ingredient used for moisturization and skin-conditioning claims.',
    array['skin_conditioning'],
    array['hydration', 'barrier'],
    'imported'
  )
on conflict (canonical_name) do update
set inci_name = excluded.inci_name,
    korean_name = excluded.korean_name,
    definition = excluded.definition,
    function_tags = excluded.function_tags,
    benefit_tags = excluded.benefit_tags,
    source_status = excluded.source_status;

insert into public.ingredient_aliases (ingredient_id, alias, normalized_alias, language, source, confidence)
select id, 'Sodium Hyaluronate', 'sodium hyaluronate', 'inci', 'seed', 1
from public.ingredients
where canonical_name = 'Sodium Hyaluronate'
on conflict (normalized_alias, language) do nothing;

insert into public.ingredient_aliases (ingredient_id, alias, normalized_alias, language, source, confidence)
select id, 'Hyaluronic Acid', 'hyaluronic acid', 'en', 'seed', 0.85
from public.ingredients
where canonical_name = 'Sodium Hyaluronate'
on conflict (normalized_alias, language) do nothing;

insert into public.ingredient_aliases (ingredient_id, alias, normalized_alias, language, source, confidence)
select id, 'Fragrance', 'fragrance', 'en', 'seed', 1
from public.ingredients
where canonical_name = 'Fragrance'
on conflict (normalized_alias, language) do nothing;

insert into public.ingredient_aliases (ingredient_id, alias, normalized_alias, language, source, confidence)
select id, 'Parfum', 'parfum', 'inci', 'seed', 1
from public.ingredients
where canonical_name = 'Fragrance'
on conflict (normalized_alias, language) do nothing;

insert into public.ingredient_aliases (ingredient_id, alias, normalized_alias, language, source, confidence)
select id, 'Snail Secretion Filtrate', 'snail secretion filtrate', 'inci', 'seed', 1
from public.ingredients
where canonical_name = 'Snail Secretion Filtrate'
on conflict (normalized_alias, language) do nothing;

insert into public.product_ingredients (product_id, ingredient_id, raw_name, matched_name, position, match_method, confidence)
select p.id, i.id, i.canonical_name, i.canonical_name, 1, 'exact', 1
from public.products p
join public.ingredients i on i.canonical_name = 'Snail Secretion Filtrate'
where p.slug = 'cosrx-advanced-snail-96-mucin-power-essence'
on conflict (product_id, position) do nothing;

insert into public.product_ingredients (product_id, ingredient_id, raw_name, matched_name, position, match_method, confidence)
select p.id, i.id, i.canonical_name, i.canonical_name, 2, 'exact', 1
from public.products p
join public.ingredients i on i.canonical_name = 'Sodium Hyaluronate'
where p.slug = 'cosrx-advanced-snail-96-mucin-power-essence'
on conflict (product_id, position) do nothing;

insert into public.product_ingredients (product_id, ingredient_id, raw_name, matched_name, position, match_method, confidence)
select p.id, i.id, i.canonical_name, i.canonical_name, 1, 'exact', 1
from public.products p
join public.ingredients i on i.canonical_name = 'Sodium Hyaluronate'
where p.slug = 'laneige-water-bank-blue-hyaluronic-cream'
on conflict (product_id, position) do nothing;

insert into public.product_ingredients (product_id, ingredient_id, raw_name, matched_name, position, match_method, confidence)
select p.id, i.id, i.canonical_name, i.canonical_name, 2, 'exact', 1
from public.products p
join public.ingredients i on i.canonical_name = 'Fragrance'
where p.slug = 'laneige-water-bank-blue-hyaluronic-cream'
on conflict (product_id, position) do nothing;

insert into public.ingredient_evidence (
  ingredient_id,
  source_name,
  source_url,
  source_region,
  source_type,
  claim_type,
  excerpt_summary,
  importer_version
)
select
  i.id,
  'Internal MVP seed rule',
  null,
  'global',
  'internal_rule',
  'fragrance_disclosure',
  'Generic fragrance disclosure can matter for fragrance-sensitive users.',
  'seed-v1'
from public.ingredients i
where i.canonical_name = 'Fragrance'
and not exists (
  select 1
  from public.ingredient_evidence e
  where e.ingredient_id = i.id
  and e.source_name = 'Internal MVP seed rule'
  and e.claim_type = 'fragrance_disclosure'
);

insert into public.ingredient_safety_rules (
  ingredient_id,
  rule_type,
  severity,
  condition,
  title,
  why_it_matters,
  who_should_care,
  recommendation,
  evidence_id,
  version,
  active
)
select
  i.id,
  'fragrance_undisclosed',
  'avoid_if_sensitive',
  '{"match":"ingredient"}'::jsonb,
  'Fragrance ingredient detected',
  'Generic fragrance disclosure can matter for users with fragrance sensitivity.',
  'Users with fragrance sensitivity or allergic contact dermatitis history.',
  'Check the product label and patch test before use.',
  e.id,
  1,
  true
from public.ingredients i
join public.ingredient_evidence e on e.ingredient_id = i.id
where i.canonical_name = 'Fragrance'
and e.source_name = 'Internal MVP seed rule'
and not exists (
  select 1
  from public.ingredient_safety_rules r
  where r.ingredient_id = i.id
  and r.rule_type = 'fragrance_undisclosed'
);

insert into public.safety_analysis_runs (
  product_id,
  parser_version,
  rule_version,
  status,
  triggered_by,
  flag_count,
  finished_at
)
select
  p.id,
  'seed-parser-v1',
  'seed-rules-v1',
  'succeeded',
  'import',
  1,
  now()
from public.products p
where p.slug = 'laneige-water-bank-blue-hyaluronic-cream'
and not exists (
  select 1
  from public.safety_analysis_runs sar
  where sar.product_id = p.id
  and sar.status = 'succeeded'
);

insert into public.product_safety_flags (
  product_id,
  ingredient_id,
  rule_id,
  rule_version,
  rule_snapshot,
  analysis_run_id,
  severity,
  title,
  why_it_matters,
  who_should_care,
  recommendation,
  source_label,
  source_region,
  source_url
)
select
  p.id,
  i.id,
  r.id,
  r.version,
  jsonb_build_object('ruleType', r.rule_type, 'version', r.version),
  sar.id,
  r.severity,
  r.title,
  r.why_it_matters,
  r.who_should_care,
  r.recommendation,
  'Internal MVP seed rule',
  'global',
  null
from public.products p
join public.ingredients i on i.canonical_name = 'Fragrance'
join public.ingredient_safety_rules r on r.ingredient_id = i.id and r.rule_type = 'fragrance_undisclosed'
join public.safety_analysis_runs sar on sar.product_id = p.id and sar.status = 'succeeded'
where p.slug = 'laneige-water-bank-blue-hyaluronic-cream'
and not exists (
  select 1
  from public.product_safety_flags psf
  where psf.product_id = p.id
  and psf.rule_id = r.id
  and psf.analysis_run_id = sar.id
);

insert into public.crawl_tasks (
  source_id,
  task_type,
  target_url,
  status,
  next_run_at
)
select
  s.id,
  'fetch_product_detail',
  'manual://products/laneige-water-bank-blue-hyaluronic-cream',
  'queued',
  now() - interval '1 minute'
from public.ingestion_sources s
where s.name = 'Manual Import'
and not exists (
  select 1
  from public.crawl_tasks ct
  where ct.source_id = s.id
  and ct.target_url = 'manual://products/laneige-water-bank-blue-hyaluronic-cream'
);
