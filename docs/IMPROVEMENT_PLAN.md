# ForecastHub Improvement Plan

> Comprehensive audit conducted 2026-03-29. Covers security, performance, UX, testing, and production readiness across the full stack.

---

## 1. Executive Summary

ForecastHub is a well-architected demand forecasting dashboard with a clean separation between a FastAPI backend and Next.js frontend. The codebase demonstrates strong engineering fundamentals: typed API client, input validation with bounds, async store with locking, security headers, and error boundaries. However, significant gaps exist in production reliability, test coverage, and operational resilience.

**Scores (out of 10):**

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Security** | 7/10 | Good headers, JWT auth, input validation, rate limiting. Gaps: known vulnerability in `python-multipart`, RLS not enforced, auth disabled in non-production. |
| **Performance** | 5/10 | Backend 502 errors observed in production. KPIs/forecast endpoints compute on every request (no caching). Render free tier causes cold starts. |
| **UX** | 7/10 | Clean design, good empty states, accessibility basics covered. Gaps: dashboard shows empty when backend is down, no loading feedback for slow API calls. |
| **Testing** | 6/10 | 82% backend coverage, 79% frontend statement coverage. Gaps: `db.py` at 22%, `ai_advisor.py` at 31%, ForecastChart untested, no E2E in CI. |
| **Production Readiness** | 4/10 | Backend unreliable (502s observed). Test dependencies in production. Missing env vars in docs. No monitoring/alerting. No health check dashboard. |

---

## 2. Test Results Summary

### Test Datasets Created

| Dataset | File | SKUs | Rows | Days | Industry |
|---------|------|------|------|------|----------|
| A | `test_data/small_retail.csv` | 15 | 2,700 | 180 | Grocery/convenience (USDA pricing) |
| B | `test_data/electronics_retailer.csv` | 28 | 10,220 | 365 | Consumer electronics (market pricing) |
| C | `test_data/stress_test.csv` | 120 | 36,766 | 365 | Edge cases (mixed patterns) |

### Live API Test Results (2026-03-29)

| Endpoint | Status | Response Time | Notes |
|----------|--------|---------------|-------|
| `GET /api/health` | Intermittent (200/502) | ~0.3s when working | First call succeeded, subsequent calls returned 502 |
| `GET /api/kpis` | 502 | — | `ROUTER_EXTERNAL_TARGET_ERROR` from Vercel |
| `GET /api/inventory` | 502 | — | Backend not responding |
| `GET /api/forecast/{sku}` | Not tested (backend down) | — | — |
| `POST /api/upload` | Not tested (backend down) | — | — |
| `POST /api/ask` | Not tested (backend down) | — | — |

### Frontend Load Test

| Check | Result |
|-------|--------|
| Dashboard loads | Yes — renders HTML shell with empty states |
| KPI cards | Empty/error state (backend 502) |
| Forecast chart | "No forecast data available" |
| Inventory table | No data rows |
| Alert panel | Empty |
| AI Advisor | Suggestion chips visible, but backend calls fail |
| Security headers | All present and correct (HSTS, X-Frame-Options DENY, CSP basics) |

### Unit Test Results

| Suite | Tests | Pass | Coverage |
|-------|-------|------|----------|
| Backend (pytest) | 53 | 53 (100%) | 82% overall |
| Frontend (jest) | 38 | 38 (100%) | 79.4% statements |

---

## 3. Audit Findings

### 3a. Production Reliability (Critical)

**Finding: Backend returns 502 errors intermittently**
- The live backend at Render returned `ROUTER_EXTERNAL_TARGET_ERROR` on multiple consecutive API calls
- The health endpoint succeeded once, then failed on subsequent attempts
- This means the live demo at https://forecasthub-one.vercel.app/ is **non-functional** for visitors
- **Root cause hypothesis:** Render free tier spins down after inactivity; cold start may exceed health check timeout. The `forecaster.py` imports (StatsForecast, AutoARIMA) are heavy and slow to load.
- **Severity: CRITICAL** — the primary portfolio demo is broken

**Finding: Dashboard shows empty state when backend is down**
- WebFetch of the dashboard shows: "No forecast data available", empty inventory table, empty alerts
- No user-visible error message explaining that the backend is unreachable
- KPI cards show neither data nor an error banner
- **Severity: HIGH** — visitors see an empty app with no explanation

### 3b. Security Findings

**Finding: Known vulnerability in `python-multipart` (GHSA-wp53-j4wj-2cfg)**
- Installed: 0.0.20, Fix available: 0.0.22
- This package handles file uploads in FastAPI
- **File:** `backend/requirements.txt` line with `python-multipart>=0.0.6`
- **Severity: HIGH** — actively used for file upload endpoint

**Finding: Auth disabled by default — no warning to users**
- `backend/auth.py` lines 43-49: When `SUPABASE_JWT_SECRET` is not set and `ENVIRONMENT` != `production`, all auth is bypassed
- The upload endpoint (`POST /api/upload`) and AI endpoint (`POST /api/ask`) accept requests from anyone
- **Severity: MEDIUM** — expected for demo mode, but should be documented more clearly

**Finding: CORS allows wildcard methods and headers**
- `backend/main.py` lines 101-107: `allow_methods=["*"]`, `allow_headers=["*"]`
- While origins are restricted, wildcard methods/headers weaken the CORS policy
- **Severity: LOW** — origins are properly restricted

**Finding: `_service_level_to_z` uses nearest-match lookup with only 3 entries**
- `backend/main.py` lines 335-338: Only maps 0.90, 0.95, 0.99 to z-scores
- A service level of 0.80 would map to z=1.28 (for 0.90) — incorrect
- Input validation bounds are 0.5-0.9999, but the z-score table only covers 0.90-0.99
- **File:** `backend/main.py` lines 335-338
- **Severity: MEDIUM** — produces incorrect safety stock for unusual service levels

**Finding: RLS policies are not enforced**
- `backend/migrations/001_enable_rls.sql` exists but has not been applied to production Supabase
- `db.py` line 42: `get_user_client()` falls back to admin client when `SUPABASE_ANON_KEY` is not set
- All queries bypass Row Level Security, meaning any authenticated user can see all users' data
- **File:** `backend/db.py` lines 39-46
- **Severity: MEDIUM** — currently single-user, but blocks multi-tenant support

**Finding: Rate limiting only on 3 of 8 endpoints**
- Rate limited: `POST /api/upload` (5/min), `GET /api/forecast/{sku}` (30/min), `POST /api/ask` (10/min)
- Not rate limited: `GET /api/forecast/all`, `GET /api/inventory`, `GET /api/kpis`, `GET /api/history/{sku}`, `GET /api/health`
- The `forecast/all` endpoint is the most expensive (parallelized across all SKUs) and has no rate limit
- **File:** `backend/main.py` lines 185-196
- **Severity: MEDIUM** — expensive endpoint unprotected

**Finding: Security headers confirmed present on Vercel**
- X-Frame-Options: DENY ✓
- Strict-Transport-Security: max-age=63072000; includeSubDomains; preload ✓
- X-Content-Type-Options: nosniff ✓
- Referrer-Policy: strict-origin-when-cross-origin ✓
- Permissions-Policy: camera=(), microphone=(), geolocation=() ✓
- **Status: GOOD** — no action needed

### 3c. Data Integrity Findings

**Finding: Thread safety is correct but has a subtle gap**
- `_store_lock` (asyncio.Lock) protects reads/writes to `_store["df"]`
- However, in `upload_file()` (main.py line 157), the lock is acquired only for the assignment `_store["df"] = df`
- The Supabase save (line 149) happens outside the lock — if two uploads arrive simultaneously, both could save to Supabase but only the last one would be in memory
- **File:** `backend/main.py` lines 130-182
- **Severity: LOW** — unlikely in practice with rate limiting at 5/min

**Finding: Inventory formulas are mathematically correct**
- Safety Stock: `z * std * sqrt(lead_time)` ✓ (inventory_logic.py line 47)
- Reorder Point: `avg * lead_time + SS` ✓ (inventory_logic.py line 58)
- EOQ: `sqrt(2 * D_annual * S / H)` ✓ (inventory_logic.py lines 68-72)
- Edge case handled: `holding_cost <= 0 or annual_demand <= 0` returns 0 (line 70-71) ✓
- **Status: GOOD**

**Finding: `below_reorder_point` uses `<=` instead of `<`**
- `inventory_logic.py` line 122: `inv_on_hand <= rop`
- This means a SKU with inventory exactly at the reorder point is flagged as needing reorder
- The standard convention is `inv_on_hand < rop` (at ROP, you should be reordering, not already below)
- **Severity: LOW** — minor semantic difference, borderline acceptable

### 3d. Infrastructure Findings

**Finding: Python version triple-mismatch**
- Local development: Python 3.9
- CI (GitHub Actions): Python 3.12
- Production (Render): Python 3.11
- **Files:** `.github/workflows/ci.yml` line 19, `backend/render.yaml` line 5
- **Severity: MEDIUM** — could cause subtle behavior differences

**Finding: Test dependencies installed in production**
- `backend/requirements.txt` includes: `pytest`, `httpx`, `pytest-asyncio`
- These are test-only packages that increase the production image size and attack surface
- `backend/requirements-dev.txt` exists and does `-r requirements.txt` plus dev extras
- **File:** `backend/requirements.txt`
- **Severity: MEDIUM** — unnecessary packages in production

**Finding: `security` job not in deploy dependency chain**
- `.github/workflows/ci.yml` line 91: `needs: [backend-tests, frontend-build, lint, backend-lint]`
- The `security` job is not listed — deploy proceeds even if pip-audit finds critical vulnerabilities
- The `security` job also uses `continue-on-error: true`, making it purely advisory
- **Severity: MEDIUM** — security scanning has no blocking power

**Finding: No CI caching for pip or npm**
- Neither `setup-python` nor `setup-node` use their built-in cache options
- This adds 30-60 seconds per CI run
- **File:** `.github/workflows/ci.yml`
- **Severity: LOW** — affects developer experience, not production

**Finding: Missing env vars in documentation**
- `SUPABASE_ANON_KEY` is used in `db.py` line 40 but not in `backend/.env.example`
- `ENVIRONMENT` is used in `auth.py` line 18 but not in `backend/.env.example` (it IS in `render.yaml`)
- **Files:** `backend/.env.example`, `backend/render.yaml`
- **Severity: LOW** — new developers may miss critical config

**Finding: Header duplication risk**
- Security headers are defined in both `frontend/vercel.json` and `frontend/next.config.ts`
- If one is updated without the other, they could drift
- **Severity: LOW**

### 3e. Testing Coverage Gaps

**Backend coverage by file:**

| File | Coverage | Critical Gaps |
|------|----------|---------------|
| `inventory_logic.py` | 98% | Near-complete ✓ |
| `data_loader.py` | 95% | Minor gaps (lines 25, 51, 56) |
| `forecaster.py` | 86% | `_forecast_sku_safe` wrapper untested |
| `main.py` | 77% | Lifespan startup (lines 48-77), error paths |
| `auth.py` | 59% | JWT verification path (lines 51-67) untested |
| `ai_advisor.py` | 31% | Entire `ask()` function untested |
| `db.py` | 22% | All Supabase operations untested |

**Frontend coverage by file:**

| Component | Stmt Coverage | Critical Gaps |
|-----------|--------------|---------------|
| `KPICards.tsx` | 100% | Complete ✓ |
| `AlertPanel.tsx` | 87% | Near-complete ✓ |
| `ErrorBoundary.tsx` | 89% | Minor gaps |
| `AskAI.tsx` | 80% | Copy button, localStorage persistence |
| `InventoryTable.tsx` | 75% | Export CSV, pagination |
| `Sidebar.tsx` | 73% | Mobile drawer (lines 50-67) |
| `api.ts` | 74% | Auth headers, several API methods |

**Completely untested:**
- `ForecastChart.tsx` — the primary visualization component
- `AuthGuard.tsx` — route protection
- `AuthProvider.tsx` — session management
- All page components (`src/app/*/page.tsx`)
- `supabase.ts` — client initialization
- E2E tests exist (2 smoke tests) but are not run in CI

---

## 4. Phase 1: Critical Fixes

> Must fix before any users rely on the demo. Target: 1-2 days.

### 1.1 Fix Backend Reliability on Render

**Problem:** The live backend returns 502 errors intermittently. The Render free tier spins down after inactivity, and cold starts may exceed the health check timeout. StatsForecast imports are heavy.

**Files to modify:**
- `backend/render.yaml` — add `plan: starter` or configure keep-alive
- `backend/main.py` lines 46-77 — optimize lifespan startup (lazy-load heavy imports)
- `backend/forecaster.py` line 1-14 — defer StatsForecast imports to first use

**Fix:**
1. Add a keep-alive mechanism (external cron pinging `/api/health` every 5 minutes, or upgrade Render plan)
2. Lazy-load StatsForecast in `forecaster.py` to reduce cold start time:
   ```python
   # forecaster.py — lazy import
   def _get_models():
       from statsforecast import StatsForecast
       from statsforecast.models import AutoARIMA, SeasonalNaive
       return StatsForecast, AutoARIMA, SeasonalNaive
   ```
3. Add startup timeout configuration to `render.yaml`

**Verification:** `curl https://forecasthub-one.vercel.app/api/health` returns 200 consistently after 5+ minutes of inactivity.

**Effort: M**

### 1.2 Add Backend-Down Error Banner to Dashboard

**Problem:** When the backend is unreachable, the dashboard shows empty states with no explanation. Visitors see a blank app.

**Files to modify:**
- `frontend/src/components/KPICards.tsx` lines 26-32 — error state already exists but shows a small red box
- `frontend/src/app/page.tsx` — add a prominent banner above all components when API is unreachable

**Fix:**
1. Create a `ConnectionStatus` component that calls `/api/health` on mount
2. If health check fails, show a prominent amber/red banner: "Backend is starting up — please wait 30 seconds and refresh"
3. Add auto-retry with exponential backoff

**Verification:** Spin down the backend, load the dashboard, see the banner. Backend comes up, refresh shows data.

**Effort: S**

### 1.3 Fix `python-multipart` Vulnerability

**Problem:** Known security advisory GHSA-wp53-j4wj-2cfg in python-multipart 0.0.20.

**File to modify:** `backend/requirements.txt`

**Fix:** Change `python-multipart>=0.0.6` to `python-multipart>=0.0.22`

**Verification:** `pip-audit -r requirements.txt` shows no findings for python-multipart.

**Effort: S**

### 1.4 Move Test Dependencies Out of Production

**Problem:** `pytest`, `httpx`, `pytest-asyncio` are in `requirements.txt` (installed on Render).

**File to modify:** `backend/requirements.txt`, `backend/requirements-dev.txt`

**Fix:**
1. Remove `pytest`, `httpx`, `pytest-asyncio` from `requirements.txt`
2. Add them to `requirements-dev.txt` (which already does `-r requirements.txt`)
3. Verify `render.yaml` uses `requirements.txt` (it does — line 6)

**Verification:** `pip install -r requirements.txt` no longer installs pytest. CI still passes using `requirements-dev.txt`.

**Effort: S**

---

## 5. Phase 2: Production Readiness

> Must fix before scaling to real users. Target: 3-5 days.

### 2.1 Fix `_service_level_to_z` Lookup Table

**Problem:** Only 3 entries (0.90, 0.95, 0.99). Service levels like 0.80 or 0.999 produce wrong z-scores.

**File to modify:** `backend/main.py` lines 335-338

**Fix:** Replace the dictionary lookup with `scipy.stats.norm.ppf()` or expand the table:
```python
from scipy.stats import norm

def _service_level_to_z(service_level: float) -> float:
    return norm.ppf(service_level)
```
Or if avoiding scipy dependency, expand the table to cover the full input range (0.5-0.9999).

**Verification:** `_service_level_to_z(0.80)` returns ~0.84 (not 1.28). Add unit tests.

**Effort: S**

### 2.2 Add Rate Limiting to `forecast/all` and `inventory` Endpoints

**Problem:** The most expensive endpoints (`/api/forecast/all`, `/api/inventory`) have no rate limiting.

**File to modify:** `backend/main.py` lines 185-196 (forecast/all) and 231-253 (inventory)

**Fix:** Add `@limiter.limit("10/minute")` to both endpoints and add `request: Request` parameter.

**Verification:** Hit endpoint 11 times in 1 minute — 11th should return 429.

**Effort: S**

### 2.3 Add `SUPABASE_ANON_KEY` and `ENVIRONMENT` to `.env.example`

**Problem:** These env vars are used in code but not documented for setup.

**Files to modify:**
- `backend/.env.example` — add `SUPABASE_ANON_KEY=` and `ENVIRONMENT=development`
- `backend/render.yaml` — add `SUPABASE_ANON_KEY` env var entry

**Verification:** New developer can set up the project using only `.env.example` guidance.

**Effort: S**

### 2.4 Restrict CORS Methods and Headers

**Problem:** `allow_methods=["*"]`, `allow_headers=["*"]` is overly permissive.

**File to modify:** `backend/main.py` lines 101-107

**Fix:**
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)
```

**Verification:** `OPTIONS` preflight works. `DELETE` method is rejected with CORS error.

**Effort: S**

### 2.5 Align CI Python Version with Render

**Problem:** CI uses 3.12, Render uses 3.11. Behavior differences are possible.

**File to modify:** `.github/workflows/ci.yml` lines 19, 66

**Fix:** Change `python-version: "3.12"` to `python-version: "3.11"` in both `backend-tests` and `backend-lint` jobs.

**Verification:** CI pipeline passes with Python 3.11.

**Effort: S**

### 2.6 Add CI Caching

**Problem:** No pip/npm caching in CI — slower builds.

**File to modify:** `.github/workflows/ci.yml`

**Fix:** Add `cache: 'pip'` to `setup-python` and `cache: 'npm'` to `setup-node`:
```yaml
- uses: actions/setup-python@v5
  with:
    python-version: "3.11"
    cache: 'pip'
    cache-dependency-path: backend/requirements-dev.txt
```
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: "20"
    cache: 'npm'
    cache-dependency-path: frontend/package-lock.json
```

**Verification:** Second CI run shows "cache hit" in logs.

**Effort: S**

---

## 6. Phase 3: UX Improvements

> Should fix for good user experience. Target: 3-5 days.

### 3.1 Add Loading Skeleton for Dashboard Components

**Problem:** Components show nothing while API calls are in flight (especially with cold-start delays of 10-30 seconds).

**Files to modify:**
- `frontend/src/components/ForecastChart.tsx` lines 178-181 — loading state exists but is minimal
- `frontend/src/app/page.tsx` — add connection status indicator

**Fix:** Add a global "Connecting to server..." state with a progress indicator. Show skeleton UI that matches the final layout shape.

**Effort: M**

### 3.2 Deduplicate API Calls on Dashboard

**Problem:** The dashboard page loads data from `/api/inventory` three times independently (ForecastChart for SKU list, InventoryTable, AlertPanel).

**Files to modify:**
- `frontend/src/app/page.tsx` — lift data fetching to page level
- `frontend/src/components/ForecastChart.tsx` line 38 — remove independent inventory fetch
- `frontend/src/components/AlertPanel.tsx` line 14 — accept alerts as props instead of fetching

**Fix:** Fetch inventory once at the dashboard page level and pass data down as props to ForecastChart (SKU list), InventoryTable, and AlertPanel.

**Verification:** Network tab shows 1 call to `/api/inventory` instead of 3 on dashboard load.

**Effort: M**

### 3.3 Add Error Recovery for AI Advisor When Backend is Down

**Problem:** AskAI shows "Cannot connect to backend" error but no retry mechanism.

**File to modify:** `frontend/src/components/AskAI.tsx` lines 84-85

**Fix:** Add a "Retry" button next to the error message. Implement auto-retry with visual countdown.

**Effort: S**

### 3.4 Improve 404 Page with Navigation

**Problem:** The 404 page exists but could be more helpful.

**File to modify:** `frontend/src/app/not-found.tsx`

**Fix:** Add links to all main pages (Dashboard, Inventory, Alerts, AI Advisor, Upload) instead of just "Back to Dashboard".

**Effort: S**

---

## 7. Phase 4: Testing & CI/CD

> Should fix for maintainability. Target: 5-7 days.

### 4.1 Add Tests for `db.py` (22% → 80%+)

**Problem:** The entire persistence layer is untested.

**Files to create/modify:**
- `backend/tests/test_db.py` — new file
- Mock `create_client` and test `load_dataframe`, `save_dataframe`, `record_upload`

**Test cases:**
1. `get_admin_client()` — creates client with correct URL/key
2. `get_user_client()` — falls back to admin when anon key missing
3. `save_dataframe()` — batches correctly, handles failures
4. `load_dataframe()` — returns DataFrame from response data
5. `record_upload()` — inserts correct metadata

**Effort: M**

### 4.2 Add Tests for `ai_advisor.py` (31% → 80%+)

**Problem:** The AI advisor feature has no functional tests.

**Files to create/modify:**
- `backend/tests/test_ai_advisor.py` — new file
- Mock the Groq client

**Test cases:**
1. `ask()` — returns answer/model/tokens with mock Groq
2. `ask()` — raises EnvironmentError when no API key
3. Context formatting includes inventory and forecast data
4. Langfuse tracing is called when available

**Effort: M**

### 4.3 Add Tests for `auth.py` JWT Path (59% → 90%+)

**Problem:** The actual JWT verification logic is untested.

**File to modify:** `backend/tests/test_api.py` — add auth tests

**Test cases:**
1. Valid JWT returns correct AuthUser
2. Expired JWT returns 401
3. Invalid JWT returns 401
4. Missing Authorization header returns 401
5. Production mode without JWT secret returns 401

**Effort: S**

### 4.4 Add ForecastChart Tests

**Problem:** The primary visualization component has zero test coverage.

**File to create:** `frontend/src/__tests__/ForecastChart.test.tsx`

**Test cases:**
1. Renders loading state
2. Renders chart with mock data
3. SKU dropdown populates from API
4. Horizon change triggers re-fetch
5. Export CSV produces correct file
6. Error state displays message

**Effort: M**

### 4.5 Add E2E Tests to CI

**Problem:** Playwright tests exist but aren't run in CI.

**File to modify:** `.github/workflows/ci.yml` — add new job

**Fix:**
```yaml
e2e:
  runs-on: ubuntu-latest
  defaults:
    run:
      working-directory: frontend
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: 'npm'
    - run: npm ci
    - run: npx playwright install --with-deps
    - run: npx playwright test
  continue-on-error: true
```

**Effort: S**

### 4.6 Add Coverage Thresholds

**Problem:** Coverage can regress without CI catching it.

**Files to modify:**
- `.github/workflows/ci.yml` — add `--cov-fail-under=75` to pytest command
- `frontend/jest.config.js` — add `coverageThreshold`

**Effort: S**

---

## 8. Phase 5: Performance & Optimization

> Nice to have improvements. Target: ongoing.

### 5.1 Add Forecast Caching

**Problem:** Every forecast request recomputes from scratch. The `/api/kpis` endpoint computes forecasts for ALL SKUs on every call.

**Files to modify:**
- `backend/main.py` lines 289-323 — KPIs endpoint iterates all SKUs
- `backend/forecaster.py` — add in-memory cache with TTL

**Fix:** Add an LRU cache with TTL (e.g., 5 minutes) for forecast results. The cache key should be `(sku, horizon, data_hash)` so uploads invalidate the cache.

**Verification:** Second call to `/api/kpis` returns in <100ms (vs 5-10s for first call).

**Effort: L**

### 5.2 Add Client-Side Data Caching

**Problem:** Every page mount re-fetches all data from the API. Navigation between pages triggers redundant calls.

**Files to modify:**
- `frontend/src/lib/api.ts` — add SWR or React Query wrapper
- All components that call `api.*` directly

**Fix:** Introduce `swr` or `@tanstack/react-query` for client-side caching with stale-while-revalidate.

**Effort: L**

### 5.3 Optimize Bundle Size

**Problem:** Recharts and react-markdown are large dependencies loaded on every page.

**Files to modify:**
- `frontend/src/components/ForecastChart.tsx` — dynamic import
- `frontend/src/components/AskAI.tsx` — dynamic import for Markdown

**Fix:** Use `next/dynamic` to lazy-load Recharts and react-markdown only on pages that need them.

**Verification:** `ANALYZE=true npm run build` shows reduced initial bundle.

**Effort: M**

### 5.4 Add Monitoring and Alerting

**Problem:** No visibility into production errors or performance.

**Fix:**
- Add Sentry (free tier) to both frontend and backend for error tracking
- Add uptime monitoring (e.g., UptimeRobot free tier) for `/api/health`
- Consider Render's built-in metrics for response times

**Effort: M**

---

## 9. Implementation Order

```
Phase 1 (Critical) — all items are independent, can be done in parallel:
├── 1.1 Fix backend reliability (M) ← HIGHEST PRIORITY
├── 1.2 Add backend-down banner (S)
├── 1.3 Fix python-multipart vuln (S)
└── 1.4 Move test deps to dev (S)

Phase 2 (Production) — mostly independent:
├── 2.1 Fix z-score lookup (S)
├── 2.2 Add rate limiting (S)
├── 2.3 Document env vars (S)
├── 2.4 Restrict CORS (S)
├── 2.5 Align Python versions (S) ← do before 4.x
└── 2.6 Add CI caching (S)

Phase 3 (UX) — some dependencies:
├── 3.1 Loading skeletons (M)
├── 3.2 Deduplicate API calls (M) ← depends on 3.1
├── 3.3 AI retry mechanism (S)
└── 3.4 Improve 404 page (S)

Phase 4 (Testing) — independent:
├── 4.1 Test db.py (M)
├── 4.2 Test ai_advisor.py (M)
├── 4.3 Test auth.py JWT (S)
├── 4.4 Test ForecastChart (M)
├── 4.5 E2E tests in CI (S) ← after 2.5
└── 4.6 Coverage thresholds (S) ← after 4.1-4.4

Phase 5 (Performance) — sequential:
├── 5.1 Forecast caching (L) ← HIGHEST IMPACT
├── 5.2 Client-side caching (L)
├── 5.3 Optimize bundle (M)
└── 5.4 Add monitoring (M)
```

---

## 10. Estimated Effort

| ID | Item | Effort | Phase |
|----|------|--------|-------|
| 1.1 | Fix backend reliability | M (2-4h) | 1 |
| 1.2 | Backend-down banner | S (1-2h) | 1 |
| 1.3 | Fix python-multipart | S (<30m) | 1 |
| 1.4 | Move test deps | S (<30m) | 1 |
| 2.1 | Fix z-score lookup | S (1h) | 2 |
| 2.2 | Rate limit expensive endpoints | S (30m) | 2 |
| 2.3 | Document env vars | S (30m) | 2 |
| 2.4 | Restrict CORS | S (30m) | 2 |
| 2.5 | Align Python versions | S (30m) | 2 |
| 2.6 | CI caching | S (30m) | 2 |
| 3.1 | Loading skeletons | M (2-3h) | 3 |
| 3.2 | Deduplicate API calls | M (2-3h) | 3 |
| 3.3 | AI retry mechanism | S (1h) | 3 |
| 3.4 | Improve 404 page | S (30m) | 3 |
| 4.1 | Test db.py | M (3-4h) | 4 |
| 4.2 | Test ai_advisor.py | M (2-3h) | 4 |
| 4.3 | Test auth.py JWT | S (1-2h) | 4 |
| 4.4 | Test ForecastChart | M (2-3h) | 4 |
| 4.5 | E2E in CI | S (1h) | 4 |
| 4.6 | Coverage thresholds | S (30m) | 4 |
| 5.1 | Forecast caching | L (4-6h) | 5 |
| 5.2 | Client-side caching | L (4-6h) | 5 |
| 5.3 | Optimize bundle | M (2-3h) | 5 |
| 5.4 | Monitoring | M (2-3h) | 5 |

**Total estimated effort:** ~35-50 hours across all phases.

---

*Audit conducted 2026-03-29 by Claude (Opus). All findings verified against codebase at commit HEAD of main branch.*
