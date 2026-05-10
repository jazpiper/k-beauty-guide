create or replace function public.is_admin(required_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
    and au.active = true
    and (
      required_roles is null
      or au.role = any(required_roles)
      or au.role = 'super_admin'
    )
  );
$$;

alter table public.admin_users enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_sources enable row level security;
alter table public.ingredients enable row level security;
alter table public.ingredient_aliases enable row level security;
alter table public.product_ingredients enable row level security;
alter table public.ingredient_evidence enable row level security;
alter table public.ingredient_safety_rules enable row level security;
alter table public.safety_analysis_runs enable row level security;
alter table public.product_safety_flags enable row level security;
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

revoke all on public.admin_users from anon, authenticated;
revoke all on public.brands from anon, authenticated;
revoke all on public.products from anon, authenticated;
revoke all on public.product_images from anon, authenticated;
revoke all on public.product_sources from anon, authenticated;
revoke all on public.ingredients from anon, authenticated;
revoke all on public.ingredient_aliases from anon, authenticated;
revoke all on public.product_ingredients from anon, authenticated;
revoke all on public.ingredient_evidence from anon, authenticated;
revoke all on public.ingredient_safety_rules from anon, authenticated;
revoke all on public.safety_analysis_runs from anon, authenticated;
revoke all on public.product_safety_flags from anon, authenticated;
revoke all on public.ingestion_sources from anon, authenticated;
revoke all on public.crawl_tasks from anon, authenticated;
revoke all on public.raw_product_snapshots from anon, authenticated;
revoke all on public.product_candidates from anon, authenticated;
revoke all on public.candidate_embeddings from anon, authenticated;
revoke all on public.duplicate_suggestions from anon, authenticated;
revoke all on public.prompt_versions from anon, authenticated;
revoke all on public.ai_assessment_runs from anon, authenticated;
revoke all on public.field_extraction_suggestions from anon, authenticated;
revoke all on public.review_items from anon, authenticated;
revoke all on public.admin_audit_logs from anon, authenticated;

create policy "admins can read admin users"
  on public.admin_users for select to authenticated
  using (public.is_admin());

create policy "super admins can manage admin users"
  on public.admin_users for all to authenticated
  using (public.is_admin(array['super_admin']))
  with check (public.is_admin(array['super_admin']));

create policy "public can read brands with published products"
  on public.brands for select to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.brand_id = brands.id
      and p.status = 'published'
    )
  );

create policy "admins can manage brands"
  on public.brands for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "public can read published products"
  on public.products for select to anon, authenticated
  using (status = 'published');

create policy "admins can manage products"
  on public.products for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "public can read images for published products"
  on public.product_images for select to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_images.product_id
      and p.status = 'published'
    )
  );

create policy "admins can manage product images"
  on public.product_images for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "public can read sources for published products"
  on public.product_sources for select to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_sources.product_id
      and p.status = 'published'
    )
  );

create policy "admins can manage product sources"
  on public.product_sources for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "public can read verified ingredients"
  on public.ingredients for select to anon, authenticated
  using (source_status in ('verified', 'imported'));

create policy "admins can manage ingredients"
  on public.ingredients for all to authenticated
  using (public.is_admin(array['ingredient_editor', 'safety_rule_admin']))
  with check (public.is_admin(array['ingredient_editor', 'safety_rule_admin']));

create policy "public can read public aliases"
  on public.ingredient_aliases for select to anon, authenticated
  using (
    exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_aliases.ingredient_id
      and i.source_status in ('verified', 'imported')
    )
  );

create policy "admins can manage aliases"
  on public.ingredient_aliases for all to authenticated
  using (public.is_admin(array['ingredient_editor', 'safety_rule_admin']))
  with check (public.is_admin(array['ingredient_editor', 'safety_rule_admin']));

create policy "public can read product ingredients for published products"
  on public.product_ingredients for select to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_ingredients.product_id
      and p.status = 'published'
    )
  );

create policy "admins can manage product ingredients"
  on public.product_ingredients for all to authenticated
  using (public.is_admin(array['reviewer', 'ingredient_editor', 'safety_rule_admin']))
  with check (public.is_admin(array['reviewer', 'ingredient_editor', 'safety_rule_admin']));

create policy "admins can manage ingredient evidence"
  on public.ingredient_evidence for all to authenticated
  using (public.is_admin(array['ingredient_editor', 'safety_rule_admin']))
  with check (public.is_admin(array['ingredient_editor', 'safety_rule_admin']));

create policy "public can read active rule signal metadata"
  on public.ingredient_safety_rules for select to anon, authenticated
  using (
    active = true
    and exists (
      select 1
      from public.ingredients i
      where i.id = ingredient_safety_rules.ingredient_id
      and i.source_status in ('verified', 'imported')
    )
  );

create policy "admins can manage safety rules"
  on public.ingredient_safety_rules for all to authenticated
  using (public.is_admin(array['safety_rule_admin']))
  with check (public.is_admin(array['safety_rule_admin']));

create policy "admins can manage safety analysis runs"
  on public.safety_analysis_runs for all to authenticated
  using (public.is_admin(array['safety_rule_admin']))
  with check (public.is_admin(array['safety_rule_admin']));

create policy "public can read succeeded safety run metadata"
  on public.safety_analysis_runs for select to anon, authenticated
  using (
    status = 'succeeded'
    and exists (
      select 1
      from public.products p
      where p.id = safety_analysis_runs.product_id
      and p.status = 'published'
    )
  );

create policy "public can read safety flags for published products"
  on public.product_safety_flags for select to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      where p.id = product_safety_flags.product_id
      and p.status = 'published'
    )
  );

create policy "admins can manage safety flags"
  on public.product_safety_flags for all to authenticated
  using (public.is_admin(array['safety_rule_admin']))
  with check (public.is_admin(array['safety_rule_admin']));

create policy "admins can manage ingestion sources"
  on public.ingestion_sources for all to authenticated
  using (public.is_admin(array['super_admin']))
  with check (public.is_admin(array['super_admin']));

create policy "admins can manage crawl tasks"
  on public.crawl_tasks for all to authenticated
  using (public.is_admin(array['super_admin']))
  with check (public.is_admin(array['super_admin']));

create policy "admins can manage raw snapshots"
  on public.raw_product_snapshots for all to authenticated
  using (public.is_admin(array['reviewer', 'super_admin']))
  with check (public.is_admin(array['reviewer', 'super_admin']));

create policy "admins can manage product candidates"
  on public.product_candidates for all to authenticated
  using (public.is_admin(array['reviewer']))
  with check (public.is_admin(array['reviewer']));

create policy "admins can manage candidate embeddings"
  on public.candidate_embeddings for all to authenticated
  using (public.is_admin(array['reviewer']))
  with check (public.is_admin(array['reviewer']));

create policy "admins can manage duplicate suggestions"
  on public.duplicate_suggestions for all to authenticated
  using (public.is_admin(array['reviewer']))
  with check (public.is_admin(array['reviewer']));

create policy "admins can manage prompt versions"
  on public.prompt_versions for all to authenticated
  using (public.is_admin(array['super_admin']))
  with check (public.is_admin(array['super_admin']));

create policy "admins can manage ai assessment runs"
  on public.ai_assessment_runs for all to authenticated
  using (public.is_admin(array['reviewer']))
  with check (public.is_admin(array['reviewer']));

create policy "admins can manage field suggestions"
  on public.field_extraction_suggestions for all to authenticated
  using (public.is_admin(array['reviewer']))
  with check (public.is_admin(array['reviewer']));

create policy "admins can manage review items"
  on public.review_items for all to authenticated
  using (public.is_admin(array['reviewer', 'ingredient_editor', 'safety_rule_admin']))
  with check (public.is_admin(array['reviewer', 'ingredient_editor', 'safety_rule_admin']));

create policy "admins can read audit logs"
  on public.admin_audit_logs for select to authenticated
  using (public.is_admin());

create policy "admins can create audit logs"
  on public.admin_audit_logs for insert to authenticated
  with check (public.is_admin());

grant select (
  id,
  name,
  slug,
  country,
  official_url,
  created_at,
  updated_at
) on public.brands to anon, authenticated;

grant select (
  id,
  brand_id,
  name,
  slug,
  category,
  description,
  price_krw,
  currency,
  status,
  primary_image_url,
  published_at,
  created_at,
  updated_at
) on public.products to anon, authenticated;

grant select (
  id,
  product_id,
  storage_path,
  source_url,
  alt_text,
  position,
  created_at
) on public.product_images to anon, authenticated;

grant select (
  id,
  product_id,
  source_product_id,
  source_url,
  source_price,
  source_currency,
  first_seen_at,
  last_seen_at
) on public.product_sources to anon, authenticated;

grant select (
  id,
  canonical_name,
  inci_name,
  korean_name,
  definition,
  function_tags,
  benefit_tags,
  source_status,
  created_at,
  updated_at
) on public.ingredients to anon, authenticated;

grant select (
  ingredient_id,
  alias,
  normalized_alias,
  language
) on public.ingredient_aliases to anon, authenticated;

grant select (
  product_id,
  ingredient_id,
  position
) on public.product_ingredients to anon, authenticated;

grant select (
  ingredient_id,
  active
) on public.ingredient_safety_rules to anon, authenticated;

grant select (
  id,
  product_id,
  status,
  finished_at,
  created_at
) on public.safety_analysis_runs to anon, authenticated;

grant select (
  id,
  product_id,
  analysis_run_id,
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
where p.status = 'published';

create or replace view public.v_public_ingredients
with (security_invoker = true) as
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
left join lateral (
  select sar.id
  from public.safety_analysis_runs sar
  where sar.product_id = p.id
  and sar.status = 'succeeded'
  order by sar.finished_at desc nulls last, sar.created_at desc
  limit 1
) latest_sar on true
where p.status = 'published'
and psf.analysis_run_id = latest_sar.id;

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
    'brand', jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'slug', b.slug,
      'officialUrl', b.official_url
    ),
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
    'ingredients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'position', pi.position,
        'ingredientId', pi.ingredient_id,
        'displayName', coalesce(i.canonical_name, 'Ingredient under review'),
        'inciName', i.inci_name,
        'koreanName', i.korean_name,
        'reviewStatus', case when pi.ingredient_id is null or i.id is null then 'under_review' else 'matched' end
      ) order by pi.position)
      from public.product_ingredients pi
      left join public.ingredients i
        on i.id = pi.ingredient_id
        and i.source_status in ('verified', 'imported')
      where pi.product_id = p.id
    ), '[]'::jsonb),
    'safetyReport', jsonb_build_object(
      'productId', p.id,
      'generatedAt', latest_sar.finished_at,
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
          'ingredientName', coalesce(i.canonical_name, 'Ingredient under review'),
          'severity', psf.severity,
          'title', psf.title,
          'whyItMatters', psf.why_it_matters,
          'whoShouldCare', psf.who_should_care,
          'recommendation', psf.recommendation,
          'sourceLabel', psf.source_label,
          'sourceRegion', psf.source_region,
          'sourceUrl', psf.source_url
        ) order by case psf.severity
          when 'restricted' then 4
          when 'avoid_if_sensitive' then 3
          when 'caution' then 2
          when 'info' then 1
          else 0
        end desc)
        from public.product_safety_flags psf
        left join public.ingredients i
          on i.id = psf.ingredient_id
          and i.source_status in ('verified', 'imported')
        where psf.product_id = p.id
        and psf.analysis_run_id = latest_sar.id
      ), '[]'::jsonb)
    ),
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
    'updatedAt', p.updated_at
  )
  from public.products p
  join public.brands b on b.id = p.brand_id
  left join lateral (
    select sar.id, sar.finished_at
    from public.safety_analysis_runs sar
    where sar.product_id = p.id
    and sar.status = 'succeeded'
    order by sar.finished_at desc nulls last, sar.created_at desc
    limit 1
  ) latest_sar on true
  where p.slug = product_slug
  and p.status = 'published'
  limit 1;
$$;

revoke all on function public.is_admin(text[]) from anon;
grant execute on function public.is_admin(text[]) to authenticated;
revoke all on function public.get_public_product_detail(text) from public;
grant execute on function public.get_public_product_detail(text) to anon, authenticated;
grant select on public.v_public_products to anon, authenticated;
grant select on public.v_public_ingredients to anon, authenticated;
grant select on public.v_public_product_safety_flags to anon, authenticated;
