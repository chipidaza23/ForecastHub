# ForecastHub — CLAUDE.md

> This file is the primary context for Claude Code sessions. Read it fully before doing anything.
> **Self-improving:** If you discover a gotcha, convention, or useful pattern not documented here, append it to the appropriate section before finishing your session.

## Project Overview

ForecastHub is an open-source demand forecasting dashboard with AI-powered inventory optimization. It's a portfolio project for Jaime Daza (GitHub: chipidaza23) targeting PM/BA/strategic roles at companies like SpaceX, Meta, NVIDIA, World Bank, IMF, OAS.

- **Live demo:** https://forecasthub-one.vercel.app
- **Repo:** https://github.com/chipidaza23/ForecastHub
- **Portfolio:** https://jaimedaza.com
- **Status:** Active development — 5-phase audit improvement plan completed. Production-ready with caveats.

## Architecture

- **Backend:** FastAPI (Python 3.11 on Render, 3.12 in CI)
  - `main.py` — API routes with input validation (Query bounds), async store with Lock, pagination
  - `forecaster.py` — StatsForecast engine (AutoARIMA + SeasonalNaive), parallelized via ProcessPoolExecutor
  - `inventory_logic.py` — Safety stock, ROP, EOQ calculations
  - `ai_advisor.py` — Groq (Llama 3.3 70B) for natural language inventory queries
  - `data_loader.py` — CSV/Excel ingestion + synthetic demo data generator
  - `db.py` — Supabase persistence: `get_admin_client()` (service key, bypasses RLS) + `get_user_client(jwt)` (anon key, RLS)
  - `auth.py` — JWT auth returning `AuthUser` dataclass, production enforcement via ENVIRONMENT env var
  - `migrations/` — SQL migrations: `001_enable_rls.sql`, `002_initial_schema.sql`

- **Frontend:** Next.js 16.2 (App Router) + TypeScript + Tailwind CSS v4 + Recharts 3
  - `src/app/` — Pages: dashboard, inventory, alerts, ask, upload, login, 404
  - `src/components/` — ForecastChart, InventoryTable, AlertPanel, AskAI, KPICards, Sidebar, AuthGuard, AuthProvider, ErrorBoundary
  - `src/lib/api.ts` — Typed HTTP client with AbortSignal support and 30s timeout
  - `src/lib/supabase.ts` — Supabase client (null when not configured)
  - `e2e/` — Playwright smoke tests (foundation)

- **Deployment:**
  - Frontend: Vercel (auto-deploys from main) — `vercel.json` configures security headers + static asset caching
  - Backend: Render (Python 3.11 pinned in `render.yaml`, health check at `/api/health`)
  - CI: GitHub Actions (`.github/workflows/ci.yml`) — 6 jobs

## Quick Start

```bash
# Backend
cd backend && pip install -r requirements.txt
cp .env.example .env   # fill in keys (all optional for local dev)
uvicorn main:app --reload

# Frontend
cd frontend && npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

## Common Commands

```bash
# Backend
cd backend && python -m pytest tests/ -v              # 53 tests
cd backend && python -m pytest tests/ -v --cov=.      # with coverage
cd backend && uvicorn main:app --reload               # dev server :8000

# Frontend
cd frontend && npm run dev                            # dev server :3000
cd frontend && npm run build                          # production build
cd frontend && npx jest --passWithNoTests             # 38 tests
cd frontend && npx jest --coverage                    # with coverage
cd frontend && npx tsc --noEmit                       # type check
cd frontend && ANALYZE=true npm run build             # bundle analyzer
cd frontend && npx playwright test                    # E2E smoke tests
```

## API Endpoints

| Method | Path | Rate Limit | Params | Description |
|--------|------|-----------|--------|-------------|
| POST | `/api/upload` | 5/min | file (max 10 MB) | Upload CSV/Excel (date, sku, quantity_sold) |
| GET | `/api/forecast/{sku}` | 30/min | `horizon` (1-365, default 14) | Single SKU forecast |
| GET | `/api/forecast/all` | — | `horizon` (1-365), `limit` (1-200), `offset` (≥0) | All SKU forecasts (paginated) |
| GET | `/api/history/{sku}` | — | `days` (1-3650, default 14) | Last N days of actuals |
| GET | `/api/inventory` | — | `lead_time` (1-365), `service_level` (0.5-0.9999), `limit`, `offset` | Per-SKU inventory status (paginated) |
| GET | `/api/kpis` | — | — | Dashboard summary metrics |
| POST | `/api/ask` | 10/min | `{"question": "..."}` | AI natural-language query |
| GET | `/api/health` | — | — | Health check |

## Frontend Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Dashboard | KPI cards + forecast chart + inventory table + alerts + AI |
| `/inventory` | InventoryTable | Sortable, searchable table with CSV export + pagination |
| `/alerts` | AlertPanel | SKUs below reorder point, sorted by urgency |
| `/ask` | AskAI | Chat interface with localStorage persistence + copy button |
| `/upload` | Upload | Drag-and-drop with client-side size/extension validation |
| `/login` | Login | Email/password auth with Supabase |
| `/*` | 404 | Not found page with "Back to Dashboard" link |

## Project Structure

```
backend/
  main.py              # FastAPI app, all endpoints, async store with Lock
  forecaster.py        # StatsForecast wrapper (ARIMA + SeasonalNaive), parallelized
  inventory_logic.py   # Safety stock, ROP, EOQ calculations
  data_loader.py       # CSV/Excel ingestion, validation, sample data gen
  ai_advisor.py        # Groq integration + Langfuse tracing (optional)
  auth.py              # JWT verification → AuthUser dataclass, production enforcement
  db.py                # Supabase dual client (admin + user) + query helpers
  migrations/          # SQL: 001_enable_rls.sql, 002_initial_schema.sql
  pyproject.toml       # ruff config (line-length=120, Python 3.11)
  requirements.txt     # Production dependencies
  requirements-dev.txt # Dev dependencies (ruff, pytest-cov)
  tests/               # 53 tests: test_api, test_forecaster, test_data_loader, test_inventory_logic

frontend/
  src/app/             # Next.js App Router pages (dashboard, inventory, alerts, ask, upload, login)
  src/components/      # ForecastChart, InventoryTable, AlertPanel, AskAI, KPICards, Sidebar, AuthGuard, AuthProvider, ErrorBoundary
  src/lib/api.ts       # Typed HTTP client with AbortSignal + 30s timeout
  src/lib/supabase.ts  # Supabase client init (null when not configured)
  src/__tests__/       # 38 tests: api, ErrorBoundary, KPICards, InventoryTable, AlertPanel, AskAI, Sidebar
  e2e/                 # Playwright smoke tests
  playwright.config.ts # Playwright config
  vercel.json          # Security headers + static asset caching
  jest.config.js       # Jest config (SWC transform, jsdom env)
  next.config.ts       # API rewrites + security headers + bundle analyzer
```

## Environment Variables

### Backend (`backend/.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | For persistence | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | For persistence | Supabase service role key (admin, bypasses RLS) |
| `SUPABASE_ANON_KEY` | For RLS | Supabase anon key (used with user JWT for RLS) |
| `GROQ_API_KEY` | For AI advisor | Groq API key |
| `FRONTEND_URL` | For CORS | Production frontend URL |
| `SUPABASE_JWT_SECRET` | For auth | Enables JWT middleware |
| `ENVIRONMENT` | For security | Set to `production` to enforce auth |
| `LANGFUSE_*` | Optional | Langfuse observability keys |

### Frontend (`frontend/.env.local`)
| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL (default: `http://localhost:8000`) |
| `NEXT_PUBLIC_SUPABASE_URL` | For auth UI | Enables login page |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For auth UI | Supabase anon key |

## Deployment

| Service | Platform | Config |
|---------|----------|--------|
| Frontend | Vercel | Auto-deploy from `frontend/` — production: `forecasthub-one.vercel.app` |
| Backend | Render | `render.yaml` — Python 3.11 pinned, health check at `/api/health`, ENVIRONMENT env var |
| Database | Supabase | Postgres with RLS migration ready (`backend/migrations/`) |

## CI/CD (GitHub Actions)

Workflow: `.github/workflows/ci.yml` — runs on push/PR to `main`

| Job | What it does |
|-----|-------------|
| `backend-tests` | `pip install -r requirements-dev.txt && pytest tests/ -v --cov=. --cov-report=term-missing` (Python 3.12) |
| `frontend-build` | `npm ci && npm run build && npx jest --passWithNoTests --coverage` (Node 20) |
| `lint` | `npm ci && npx tsc --noEmit` (TypeScript type check) |
| `backend-lint` | `pip install ruff && ruff check .` (Python linting) |
| `security` | `pip-audit` (Python) + `npm audit` (Node) — continue-on-error |
| `deploy` | Trigger Render deploy hook (main push only, after tests pass) |

**Known mismatch:** CI tests backend on Python 3.12 but Render runs 3.11. Should be aligned.

---

## Security

The following security measures are in place (implemented in Phase 1):

- **Security headers:** X-Frame-Options DENY, HSTS (2yr), X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy (in both `next.config.ts` and `vercel.json`)
- **JWT auth:** `auth.py` returns `AuthUser(user_id=...)` from token `sub` claim. Production enforcement: when `ENVIRONMENT=production` and no JWT secret, all auth endpoints return 401
- **File upload limits:** 10 MB max, enforced server-side (413) and client-side (pre-upload validation)
- **Input validation:** All query params have Pydantic `Query()` bounds (horizon 1-365, days 1-3650, service_level 0.5-0.9999, lead_time 1-365)
- **Rate limiting:** SlowAPI on write/AI endpoints (upload 5/min, forecast 30/min, ask 10/min)
- **RLS ready:** `db.py` has `get_admin_client()` (service key) and `get_user_client(jwt)` (anon key + RLS). Migration at `backend/migrations/001_enable_rls.sql`
- **CORS:** Whitelist (localhost + `FRONTEND_URL` env var)

---

## Code Conventions

### General
- Commit messages: imperative mood, prefixed with type (`fix:`, `feat:`, `refactor:`, `test:`, `docs:`, `ci:`)
- PRs: one logical change per PR, descriptive title under 70 chars, summary in body
- No dead code — delete unused imports, variables, and functions
- Always work on a branch — never commit directly to main

### Backend (Python)
- Single `main.py` for all endpoints — keep flat, no nested routers
- Type hints on all function signatures
- `auth.py` returns `AuthUser` dataclass (not raw dict) from `verify_token`
- `db.py` has dual clients: `get_admin_client()` (service key) and `get_user_client(jwt)` (anon key, RLS)
- Use Python `logging` module, not `print()` — `logger = logging.getLogger(__name__)`
- Input validation: use `Query()` with `ge`/`le` bounds on all numeric parameters
- File uploads limited to 10 MB server-side
- Auth is optional in dev (`AuthUser(user_id="default")`), enforced when `ENVIRONMENT=production`
- `forecast_all` runs in `asyncio.to_thread()` with `ProcessPoolExecutor` for parallelism
- Tests in `backend/tests/test_*.py` — run with `pytest tests/ -v`
- Lint with `ruff check .` (config in `pyproject.toml`)

### Frontend (TypeScript/React)
- One component per file in `src/components/`, pages in `src/app/{route}/page.tsx`
- Tailwind v4 utility classes only — no inline styles, no CSS modules
- All API calls go through `src/lib/api.ts` — typed HTTP client, single source of truth
- API client supports `AbortSignal` for request cancellation (30s default timeout)
- `ForecastChart` uses `AbortController` to cancel stale requests on SKU/horizon change
- `AskAI` messages persisted to `localStorage`
- All icon-only buttons must have `aria-label` attributes
- Upload page validates file size (10 MB) and extension client-side before upload
- Prefer Server Components by default; use `"use client"` only when state/effects are needed
- Tests in `frontend/src/__tests__/` — Jest with SWC transform and jsdom environment

### UX/UI Standards
- Consistent color palette: indigo for primary, slate for backgrounds, semantic colors (red=alert, green=healthy, amber=warning)
- Every data-fetching component must handle 3 states: loading (skeleton), error (message), success
- Tables: sortable columns, search filter, CSV export, responsive with overflow-x-auto
- Alerts: sorted by urgency (days_of_stock ascending), "View in Inventory" links
- Auth: graceful degradation — app works fully without Supabase configured

### Product Standards
- Every feature must work in demo mode (no external services) — critical for portfolio
- Demo data: 8 realistic SKUs with mix of healthy and alerting inventory states
- The app should degrade gracefully when the backend is slow or down

---

## Data & Persistence

### With Supabase (production)
- `data_loader.load_from_supabase()` loads data on startup
- `data_loader.save_to_supabase(df, user_id)` persists uploads per user
- `db.record_upload()` logs upload metadata
- Auth via Supabase JWT (`AuthUser` with `user_id` from `sub` claim)
- Tables: `sales_data`, `uploads` (schema in `backend/migrations/002_initial_schema.sql`)
- RLS policies ready (not yet applied): `backend/migrations/001_enable_rls.sql`

### Without Supabase (demo/local)
- Backend stores data in-memory (`_store["df"]`, protected by `asyncio.Lock`)
- Sample data generated on cold start (8 SKUs, 365 days of synthetic sales)
- Uploaded files replace the in-memory DataFrame — data lost on restart
- Auth returns `AuthUser(user_id="default")` — no data isolation

### Caching Strategy
- Backend: in-memory DataFrame is hot cache; Supabase is source of truth
- Frontend: no client-side caching — every page mount re-fetches from API
- Forecasts computed on-demand (parallelized for multi-SKU requests)

---

## Before Committing

1. Run backend tests: `cd backend && python -m pytest tests/ -v`
2. Run frontend tests: `cd frontend && npx jest`
3. Check frontend builds: `cd frontend && npm run build`
4. Check TypeScript: `cd frontend && npx tsc --noEmit`
5. Run ruff: `cd backend && ruff check .` (if Python files changed)
6. Add tests for new functionality when reasonable

---

## Periodic Improvements (When Scope Allows)

- Deduplicate API calls on Dashboard (AlertPanel, InventoryTable, ForecastChart all call `/api/inventory` independently)
- Add full E2E test suite with Playwright (foundation exists in `frontend/e2e/`)
- Apply RLS policies to Supabase and use `get_user_client()` for user-scoped queries
- Add dark mode support
- Add notification service for reorder alerts (email/Slack)
- Multi-store / multi-warehouse support
- ABC-XYZ inventory classification

---

## Known Gotchas

- **Python version mismatch:** CI uses 3.12, Render uses 3.11. If you add dependencies, test on both.
- **Tailwind v4:** Breaking changes from v3. Responsive breakpoints and some utilities differ. Check docs.
- **Next.js 16:** Read `frontend/AGENTS.md` warning. Check `node_modules/next/dist/docs/` if unsure about APIs.
- **Auth is conditional:** When `ENVIRONMENT=production` without JWT secret, auth endpoints return 401. In dev, they return `AuthUser(user_id="default")`.
- **`--passWithNoTests` in CI:** Frontend test job won't fail if all tests are removed. Run tests locally.
- **jest.config must be `.js` not `.ts`** — ts-node is not available in CI.
- **Python 3.11 must be pinned** in render.yaml; without it Render defaults to a newer version.
- **AbortController in ForecastChart:** The combined useEffect fetches both forecast + history. If you add new data fetches to the chart, include them in the same Promise.all or they'll bypass cancellation.

---

## Session Log

> Sessions: append a brief entry here when you complete meaningful work.
> Format: `- **YYYY-MM-DD** | session-name | what you did`

- **2026-03-26** | initial-scaffold | Built full project from scratch — FastAPI + Next.js + StatsForecast
- **2026-03-26** | phase-1 | Added Supabase persistence, switched to Groq/Llama, fixed broken nav
- **2026-03-26** | phase-2 | Chart improvements, sortable table, AI conversation history, data export
- **2026-03-26** | phase-3-4 | Production hardening, pytest suite, CI/CD pipeline, error boundaries
- **2026-03-28** | fix-demo-fallback | Fixed mock data fallback for Vercel
- **2026-03-28** | readme-screenshot | Added Playwright-captured screenshot and live demo URL to README
- **2026-03-28** | claude-md | Added root-level CLAUDE.md as primary session context
- **2026-03-29** | audit-phase-1 | Security fixes: AuthUser, input validation, upload limits, ForecastChart race condition, security headers, RLS prep, render.yaml
- **2026-03-29** | audit-phase-2 | Production readiness: logging, pagination, async store, batch resilience, migrations, PyJWT
- **2026-03-29** | audit-phase-3 | UX improvements: login page, protected routes, empty states, AbortController, AlertPanel sort, AskAI persistence, accessibility
- **2026-03-29** | audit-phase-4 | Testing & CI/CD: ruff linting, 5 component test files, security scanning, coverage tracking, Playwright foundation, deploy automation
- **2026-03-29** | audit-phase-5 | Performance: parallelized forecaster, bundle analyzer, vercel.json, ARCHITECTURE.md update
- **2026-03-29** | post-audit-cleanup | Pulled all 5 phases to main, cleaned up worktrees, rewrote CLAUDE.md to reflect current state

## Lessons Learned

> Hard-won knowledge so future sessions don't repeat mistakes.

- Tailwind v4 responsive breakpoints use different syntax than v3 — caught in production
- Frontend components must handle "backend unreachable" case gracefully with fallbacks
- Vercel deployment protection can block preview URLs — use production alias
- Worktree branches need to be merged to main explicitly — pushing to a worktree branch doesn't update live deployment
- jest.config must be `.js` not `.ts` — ts-node not available in CI
- Python 3.11 must be pinned in render.yaml explicitly
- When removing git worktrees that your shell is cd'd into, the shell CWD becomes invalid — always cd to main repo first
- Phase PRs that touch overlapping files need sequential merge + rebase to resolve conflicts (Phase 4 needed rebase after Phases 2-3 merged)
- AbortController in useEffect: always check `controller.signal.aborted` before setting state, and return `() => controller.abort()` as cleanup
- `get_admin_client()` bypasses RLS — use only for server-side operations. `get_user_client(jwt)` respects RLS policies.
