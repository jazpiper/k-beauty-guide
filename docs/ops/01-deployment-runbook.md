# Deployment Runbook

> 작성일: 2026-05-02
> 상태: MVP backend implementation 준비용
> 범위: CRA public/admin app, Supabase backend, Vercel deployment

이 문서는 K-Beauty Guide MVP를 로컬, 스테이징, 프로덕션으로 올릴 때 따르는 운영 절차다. 실제 배포는 Supabase migration/Edge Function 파일과 Vercel 프로젝트 연결이 만들어진 뒤 실행한다.

## 0. Current Verification Status

| Area | Status |
|---|---|
| Frontend build | `npm run build` 통과 |
| Frontend test command | `CI=true npm test -- --watch=false --passWithNoTests` 통과, 테스트 파일 없음 |
| Browser smoke | Codex in-app browser에서 products list, product detail, mobile nav, unknown slug 확인 |
| Secret scan | `src`, `public`, `.env.example`에서 service role key reference 없음 |
| Supabase local start/lint | OrbStack 2.1.1 + Docker 29.4.0에서 `npx supabase start`, `npx supabase db lint --local` 통과 |
| Supabase local reset caveat | `npx supabase db reset`은 migration/seed 적용 후 storage bucket health check timeout이 재현됨. `npx supabase stop --no-backup && npx supabase start`로 clean replay 검증 완료 |
| Supabase DB smoke | Seed counts, public views, `get_public_product_detail` RPC 확인 완료 |
| Edge Function smoke | `npm run smoke:supabase:analyzer` 통과 |
| Crawler live source check | 구현/테스트 단계에서 source별 robots/terms/rate limit 재확인 |

## 1. Environment Model

| Environment | Web | Backend | Purpose |
|---|---|---|---|
| Local | CRA dev server | Supabase local stack | 개발, migration/function smoke |
| Staging | Vercel Preview | Supabase staging project | 배포 전 검증 |
| Production | Vercel Production | Supabase production project | 실제 서비스 |

Rules:

- Production database에 직접 SQL을 수동 적용하지 않는다. migration 파일을 통해 반영한다.
- Browser bundle에는 anon/publishable key만 들어간다.
- Service role key는 Supabase Edge Function, scheduled job, trusted worker에서만 사용한다.
- 크롤러 live dry run은 source별 robots/terms/rate limit 재확인 후 staging에서 먼저 수행한다.

## 2. Required Local Tools

```bash
node --version
npm --version
npx supabase --version
npx vercel --version
```

Expected:

- Node.js는 프로젝트와 Supabase CLI가 지원하는 버전이어야 한다.
- `npx supabase --version`과 `npx vercel --version`이 정상 출력된다.
- Supabase local stack 실행을 위해 Docker 호환 runtime이 필요하다.

## 3. Required Environment Variables

### Browser-safe Vercel variables

CRA는 browser-exposed 변수에 `REACT_APP_` prefix를 사용한다.

| Name | Environment | Secret? | Notes |
|---|---|---|---|
| `REACT_APP_SUPABASE_URL` | Preview, Production | No | Supabase project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Preview, Production | No | Browser client key |

### Server-only variables

| Name | Location | Secret? | Notes |
|---|---|---|---|
| `CRON_SECRET` | Vercel, if Vercel Cron is added | Yes | At least 16 random characters |
| service role key | Supabase Edge Function runtime only | Yes | Do not add to Vercel public env or CRA env |
| LLM/embedding provider keys | Supabase secrets or trusted worker | Yes | Only after provider decision/benchmark |

Check browser code before every release:

```bash
if rg -n "service_role|SUPABASE_SERVICE_ROLE|SERVICE_ROLE_KEY" src public; then
  echo "Secret-like service role reference found in browser code"
  exit 1
else
  echo "No service role references found in browser code"
fi
```

## 4. Local Frontend Verification

Run from repo root:

```bash
npm install
CI=true npm test -- --watch=false --passWithNoTests
npm run build
```

Expected:

```text
Compiled successfully.
```

If `react-scripts: command not found` appears, run `npm install` first.

### Docker Frontend Verification

Use this path when Windows local Node/npm behavior differs from CI or CRA hangs under the host runtime.

```bash
docker build -t k-beauty-guide .
docker run --rm k-beauty-guide npm run build
docker run --rm k-beauty-guide npm test -- --watchAll=false --runInBand
```

For a containerized dev server:

```bash
docker compose up app
```

Then open `http://localhost:3000`.

## 5. Local Supabase Verification

Run after `supabase/config.toml`, migrations, seed, and functions exist:

```bash
npx supabase start
npx supabase db reset
```

Expected:

```text
Finished supabase db reset
```

Confirm required objects exist:

```bash
npx supabase status
```

Manual dashboard check:

- Local Studio opens at the URL printed by `npx supabase status`.
- Core tables exist: `products`, `ingredients`, `ingestion_sources`, `crawl_tasks`, `review_items`, `safety_analysis_runs`.
- Public views/RPCs exist: `v_public_products`, `v_public_ingredients`, `v_public_product_safety_flags`, `get_public_product_detail`.

Latest local check (2026-05-03 KST):

| Check | Result |
|---|---|
| Container runtime | OrbStack running, Docker server `29.4.0 / OrbStack` |
| Supabase CLI | `npx supabase --version` -> `2.98.0` |
| Local stack | `npx supabase start` completed and exposed Studio at `http://127.0.0.1:54323` |
| Migration/seed replay | Clean `stop --no-backup` -> `start` replay applied migrations and seed successfully |
| Reset caveat | Repeated `npx supabase db reset` applied migrations/seed but exited non-zero while checking `storage/v1/bucket`; storage became reachable after clean stop/start |
| Schema lint | `npx supabase db lint --local` returned no schema errors |
| Seed counts | `products=2`, `ingredients=3`, `ingestion_sources=1`, `crawl_tasks=1`, `safety_analysis_runs=1` |
| Public views | `v_public_products`, `v_public_ingredients`, `v_public_product_safety_flags` exist |
| Public REST smoke | `v_public_products` and `v_public_ingredients` returned rows with anon key |
| RPC smoke | `get_public_product_detail('cosrx-advanced-snail-96-mucin-power-essence')` returned a detail payload |
| Analyzer smoke | `Water, Fragrance, Hyaluronic Acid` returned 3 parsed rows, 1 unmatched token, and 1 fragrance flag |

## 6. Local Edge Function Smoke

Use a cleanup trap and curl timeout so smoke tests do not hang or leave a server process running.

```bash
npx supabase functions serve analyze-ingredient-text --no-verify-jwt &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
sleep 5

curl --max-time 10 -fsS http://127.0.0.1:54321/functions/v1/analyze-ingredient-text \
  -H "Content-Type: application/json" \
  -d '{"ingredientText":"Water, Fragrance"}'
curl_status=$?

kill "$server_pid" 2>/dev/null || true
trap - EXIT
exit "$curl_status"
```

Expected:

```json
{"ok":true}
```

Latest local check (2026-05-03 KST):

- `analyze-ingredient-text` served locally and returned `ok: true` for `Water, Fragrance, Hyaluronic Acid`.
- `Water` returned as unmatched, `Fragrance` matched exactly, `Hyaluronic Acid` matched the seeded `Sodium Hyaluronate` alias, and one `Fragrance ingredient detected` flag was returned.
- `fragrance-free` stayed unmatched and returned no safety flag.

Analyzer smoke shortcut:

```bash
npm run supabase:functions:serve:analyzer > /tmp/k-beauty-analyzer.log 2>&1 &
server_pid=$!
sleep 5
npm run smoke:supabase:analyzer
kill "$server_pid" 2>/dev/null || true
```

Expected:

```json
{
  "ok": true,
  "parsedCount": 3,
  "unmatchedCount": 1,
  "flagCount": 1
}
```

Repeat the same pattern for:

- `admin-review-action`
- `run-safety-analysis`
- `run-ai-quality`
- `claim-crawl-tasks`
- `complete-crawl-task`

For crawl lease smoke, seed or insert one enabled `ingestion_sources` row and one due `crawl_tasks` row first so `claim-crawl-tasks` can return a lease token.

## 7. Supabase Staging Deploy

Authenticate and link:

```bash
npx supabase login
npx supabase link --project-ref "$SUPABASE_STAGING_PROJECT_REF"
```

Push database migrations:

```bash
npx supabase db push
```

Deploy Edge Functions:

```bash
npx supabase functions deploy
```

Deploy individual functions only when debugging a narrow change:

```bash
npx supabase functions deploy analyze-ingredient-text
```

Do not use `--no-verify-jwt` for admin/internal functions. Public analyzer functions may be deployed without JWT verification only when rate limit and abuse controls are implemented.

## 8. Vercel Preview Deploy

Link project once:

```bash
npx vercel link
```

Add or verify Preview variables in Vercel:

```bash
npx vercel env ls preview
```

Create Preview deployment:

```bash
npx vercel deploy
```

Expected:

- Vercel returns a Preview URL.
- Preview build uses `npm run build`.
- Products and Ingredients pages render with Supabase config or static fallback.

## 9. Staging Release Gate

Before production:

- `npm run build` passes locally.
- Supabase `db push` completed against staging.
- Edge Function smoke passes against staging URLs.
- Vercel Preview URL loads.
- Public product list loads.
- Product detail loads through sanitized RPC.
- Ingredient analyzer returns parsed rows and educational disclaimer.
- Admin review queue loads for admin user.
- Crawl source pause/resume action works for admin user.
- Secret scan reports no service role reference in `src` or `public`.
- No raw snapshot is visible in public app.
- No user sensitivity data is stored server-side without consent/delete flow.

## 10. Production Deploy

Supabase production:

```bash
npx supabase link --project-ref "$SUPABASE_PRODUCTION_PROJECT_REF"
npx supabase db push
npx supabase functions deploy
```

Vercel production:

```bash
npx vercel deploy --prod
```

Post-deploy smoke:

```bash
curl --max-time 10 -fsS "$PRODUCTION_URL"
curl --max-time 10 -fsS "$PRODUCTION_URL/products"
```

Manual checks:

- Public pages load.
- Admin route is not usable by non-admin user.
- Public analyzer returns educational output, not diagnosis.
- Product safety report uses latest successful analysis only.
- Source pause state blocks crawler execution.

## 11. Cron and Scheduled Work

MVP default is Supabase Cron/work tables for crawler and safety re-analysis. If Vercel Cron is added later:

- Define cron jobs in `vercel.json`.
- Use UTC cron expressions.
- Secure cron endpoints with `CRON_SECRET`.
- Keep cron endpoint thin: enqueue Supabase work rows, then exit.

Example:

```json
{
  "crons": [
    {
      "path": "/api/cron/enqueue-crawl",
      "schedule": "0 3 * * *"
    }
  ]
}
```

The endpoint must verify:

```text
Authorization: Bearer $CRON_SECRET
```

## 12. Rollback

Frontend:

```bash
npx vercel rollback
```

Backend:

- Prefer forward-fix migrations.
- If a migration must be reverted, create an explicit rollback migration and test it on staging first.
- Disable risky sources by setting `ingestion_sources.paused_at`, `pause_reason`, or `enabled = false`.
- Stop publication by blocking admin approval or pausing source ingestion; do not delete raw evidence during incident response.

## 13. Incident Checklist

For crawler or safety incidents:

1. Pause affected `ingestion_sources`.
2. Stop or reduce scheduled task enqueueing.
3. Mark affected `review_items` as blocked.
4. Re-run safety analysis only after rule/evidence correction.
5. Keep raw snapshots and audit logs intact.
6. Record the incident and fix decision in the relevant architecture/ops doc.

## 14. Official References

- Supabase Local Development: https://supabase.com/docs/guides/local-development
- Supabase schema migrations: https://supabase.com/docs/guides/deployment/database-migrations
- Supabase Edge Function deploy: https://supabase.com/docs/guides/functions/deploy
- Vercel deployments: https://vercel.com/docs/deployments
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Vercel Cron Jobs: https://vercel.com/docs/cron-jobs
- Vercel Cron security: https://vercel.com/docs/cron-jobs/manage-cron-jobs
