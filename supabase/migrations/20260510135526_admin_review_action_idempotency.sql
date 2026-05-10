alter table public.admin_audit_logs
  add column if not exists idempotency_key text;

create unique index if not exists admin_audit_logs_review_idempotency_idx
  on public.admin_audit_logs (object_type, object_id, action, idempotency_key)
  where idempotency_key is not null;

alter table public.product_candidates
  drop constraint if exists product_candidates_status_check;

alter table public.product_candidates
  add constraint product_candidates_status_check
  check (status in ('new', 'reviewing', 'approved', 'rejected', 'merged', 'blocked'));

alter table public.review_items
  drop constraint if exists review_items_item_type_check;

alter table public.review_items
  add constraint review_items_item_type_check
  check (item_type in (
    'product_candidate',
    'product_update',
    'ingredient_match',
    'safety_rule_change',
    'restricted_signal',
    'evidence_update',
    'copy_review',
    'ingestion_alert',
    'image_candidate_review',
    'description_candidate_review',
    'claim_risk_review'
  ));
