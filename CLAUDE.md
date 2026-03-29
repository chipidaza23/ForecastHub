# ForecastHub — CLAUDE.md

> This file is the primary context for Claude Code sessions. Read it fully before doing anything.
> **Self-improving:** If you discover a gotcha, convention, or useful pattern not documented here, append it to the appropriate section before finishing your session.

## Project Overview

ForecastHub is an open-source demand forecasting dashboard with AI-powered inventory optimization. It's a portfolio project for Jaime Daza (GitHub: chipidaza23) targeting PM/BA/strategic roles at companies like SpaceX, Meta, NVIDIA, World Bank, IMF, OAS.

- **Live demo:** https://frontend-eta-sand-86.vercel.app
- **Repo:** https://github.com/chipidaza23/ForecastHub
- **Portfolio:** https://jaimedaza.com (PR #10 pending merge adds ForecastHub)
- **Status:** Active development — portfolio-ready but accepting improvements

## Architecture

- **Backend:** FastAPI (Python 3.11 on Render, 3.12 in CI — known mismatch)
  - `main.py` — API routes (upload, forecast, inventory, ask, kpis)
  - `forecaster.py` — StatsForecast engine (AutoARIMA + SeasonalNaive)
  - `inventory_logic.py` — Safety stock, ROP, EOQ calculations
  - `ai_advisor.py` — Groq (Llama 3.3 70B) for natural language inventory queries
  - `data_loader.py` — CSV/Excel ingestion + synthetic demo data generator
  - `db.py` — Supabase (Postgres) persistence
  - `auth.py` — Optional JWT auth via Supabase

- **Frontend:** Next.js (latest, may be v15+, uses app router) + TypeScript + Tailwind v4 + Recharts
  - `src/app/` — Pages (dashboard, alerts, ask, inventory, upload)
  - `src/components/` — 8 components (ForecastChart, InventoryTable, AlertPanel, AskAI, KPICards, Sidebar, etc.)
  - `src/lib/api.ts` — API client with mock data fallback for Vercel demo
  - `src/lib/mockData.ts` — 8 realistic SKUs for demo mode
  - `src/lib/supabase.ts` — Supabase client

- **Deployment:**
  - Frontend: Vercel (auto-deploys from main, Next.js auto-detected from /frontend)
  - Backend: Render (Python 3.11, see render.yaml + Procfile)
  - CI: GitHub Actions (.github/workflows/ci.yml)

## Development Workflow

### Getting Started
```bash
# Backend
cd backend && pip install -r requirements.txt
cp .env.example .env  # Fill in GROQ_API_KEY, SUPABASE_URL, etc.
uvicorn main:app --reload

# Frontend
cd frontend && npm install
cp .env.example .env.local  # Set NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

### Git Conventions
- **Always work on a branch** — never commit directly to main
- **PR workflow:** Create PR → checks pass → merge to main
- **Commit messages:** Conventional commits (feat:, fix:, docs:, chore:, test:)
- **Clean up:** Delete your branch after merging. There are stale claude/* branches on remote — ignore them.

### Before Committing
1. Run backend tests: `cd backend && python -m pytest tests/ -v`
2. Run frontend tests: `cd frontend && npm test`
3. Check frontend builds: `cd frontend && npm run build`
4. Add tests for new functionality when reasonable

### Environment Variables
- Backend: GROQ_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET (optional), FRONTEND_URL, LANGFUSE_* (optional)
- Frontend: NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

## Known Gotchas

- **Python version mismatch:** CI uses 3.12, Render uses 3.11. If you add dependencies, test on both.
- **Tailwind v4:** This project uses Tailwind v4 which has breaking changes from v3. Responsive breakpoints and some utilities differ. Check the Tailwind v4 docs before writing CSS.
- **Next.js version:** Read the warning in frontend/AGENTS.md. This may not be the Next.js you're used to. Check `node_modules/next/dist/docs/` if unsure.
- **Mock data fallback:** When the backend is unreachable, `api.ts` falls back to `mockData.ts`. If you add new API endpoints, add corresponding mock data or the Vercel demo will break.
- **Auth is optional:** When SUPABASE_JWT_SECRET is unset, auth is disabled. There's no data isolation in that case.
- **`--passWithNoTests` in CI:** Frontend test job won't fail if all tests are removed. Don't rely on CI alone — run tests locally.

## Roadmap (aspirational — only work on these if Jaime specifically asks)

- Multi-store / multi-warehouse support
- Reorder email/SMS notifications
- ABC-XYZ inventory classification
- Supplier lead-time tracking
- TimesFM or other ML model integration

## Owner Context

Jaime Daza is a PM/BA professional, not a full-time developer. He values:
- Clean, working code over perfect code
- Features that demonstrate strategic/operational thinking
- Good documentation and README presentation
- Quick iteration — ship it, then polish

---

## Session Log

> Sessions: append a brief entry here when you complete meaningful work. Format:
> `- **YYYY-MM-DD** | session-name | what you did | gotchas encountered`

- **2026-03-26** | initial-scaffold | Built full project from scratch — FastAPI + Next.js + StatsForecast
- **2026-03-26** | phase-1 | Added Supabase persistence, switched to Groq/Llama, fixed broken nav
- **2026-03-26** | phase-2 | Chart improvements, sortable table, AI conversation history, data export
- **2026-03-26** | phase-3-4 | Production hardening, pytest suite, CI/CD pipeline, error boundaries
- **2026-03-28** | fix-demo-fallback | Fixed mock data fallback for Vercel — components had no fallback when backend unreachable
- **2026-03-28** | readme-screenshot | Added Playwright-captured screenshot and live demo URL to README
- **2026-03-28** | claude-md | Added root-level CLAUDE.md as primary session context; removed minimal frontend/CLAUDE.md (superseded)

## Lessons Learned

> Sessions: append hard-won knowledge here so future sessions don't repeat mistakes.

- Tailwind v4 responsive breakpoints use different syntax than v3 — caught in production
- Frontend components must always handle the "backend unreachable" case gracefully with mock data, or the Vercel demo breaks
- Vercel deployment protection can block preview URLs — use the production alias (frontend-eta-sand-86.vercel.app)
- Worktree branches need to be merged to main explicitly — pushing to a worktree branch doesn't update the live deployment
- The `outcomePrices` field in external APIs may be a JSON string, not a native object — always parse defensively
- jest.config must be `.js` not `.ts` — ts-node is not available in CI, causing silent test failures
- Python 3.11 must be pinned explicitly in render.yaml; without it Render defaults to a newer version that breaks some dependencies
