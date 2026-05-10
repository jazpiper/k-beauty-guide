# K-Beauty Guide

## Project Overview
K-Beauty Guide is a platform for foreigners interested in K-Beauty, providing information on Korean cosmetics and ingredients. The project is a React-based web application with a planned integration of Supabase for backend services.

## Architecture
- **Frontend:** React 18 + React Router v6
- **Styling:** Vanilla CSS (Responsive)
- **Backend:** Supabase scaffold exists (Postgres migrations, RLS, public views/RPC, Edge Function shells)
- **Crawler:** Modular crawler contracts and connector shells exist; live source runtime is not wired yet
- **Deployment:** Vercel

## Building and Running
- **Install Dependencies:** `npm install`
- **Development Server:** `npm start`
- **Build:** `npm run build`
- **Test:** `npm run test`

## Project Documentation
- **Docs Index:** `docs/README.md`
- **System Overview:** `docs/architecture/01-system-overview.md`
- **Planning:** `PLANNING.md`
- **API Contract:** `docs/api/01-api-contract.md`
- **Deployment Runbook:** `docs/ops/01-deployment-runbook.md`
- **MVP Implementation:** `docs/superpowers/plans/2026-05-01-mvp-implementation-plan.md`

## Development Conventions
- Adhere to the structure defined in `docs/architecture` and `docs/superpowers`.
- Ensure responsiveness using CSS.
- For new features, refer to `docs/README.md` first, then follow the relevant architecture/API/page document.
- Treat `docs/superpowers/**` as deep planning/spec archive unless the user explicitly asks to execute one of those plans.
