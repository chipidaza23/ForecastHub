# Architecture

## Overview

ForecastHub is a two-tier web application: a **Next.js 16** dashboard talks to a **FastAPI** backend over a REST API. The backend orchestrates three independent engines — a StatsForecast forecasting engine, a Groq AI advisor (Llama 3.3 70B), and an inventory logic module. Data is persisted in **Supabase (Postgres)** with an in-memory cache for fast reads.

```
┌─────────────────────────────────────────────────────────┐
│                      ForecastHub                        │
│                                                         │
│   User (browser)                                        │
│    │                                                    │
│    ▼                                                    │
│  ┌──────────────────────┐                               │
│  │  Next.js Dashboard   │  localhost:3000               │
│  │  • KPICards          │                               │
│  │  • ForecastChart     │                               │
│  │  • InventoryTable    │                               │
│  │  • AlertPanel        │                               │
│  │  • AskAI             │                               │
│  │  • Sidebar           │                               │
│  └──────────┬───────────┘                               │
│             │  JSON over HTTP                           │
│             ▼                                           │
│  ┌──────────────────────┐                               │
│  │  FastAPI Backend     │  localhost:8000               │
│  │  main.py             │                               │
│  └──┬──────────┬────────┘                               │
│     │          │          │                             │
│     ▼          ▼          ▼                             │
│  ┌──────┐ ┌────────┐ ┌──────────┐                      │
│  │fore- │ │  ai_   │ │inventory │                      │
│  │caster│ │advisor │ │_logic    │                      │
│  │.py   │ │.py     │ │.py       │                      │
│  └──────┘ └────────┘ └──────────┘                      │
│  Stats-    Groq API    Pure math                       │
│  Forecast  Llama 3.3   (SS/ROP/EOQ)                    │
└─────────────────────────────────────────────────────────┘
```

---

## Backend

### Module Responsibilities

| File | Responsibility |
|------|---------------|
| `main.py` | FastAPI app, route definitions, CORS configuration, lifespan startup hook |
| `data_loader.py` | CSV/Excel parsing, column validation, type coercion, sample data generation |
| `forecaster.py` | StatsForecast wrapper — model fitting, ensemble logic, prediction intervals, MAPE |
| `inventory_logic.py` | Safety stock, reorder point, EOQ calculations, alert flagging |
| `ai_advisor.py` | Groq API integration (Llama 3.3 70B) — prompt construction, context injection, response parsing |
| `auth.py` | JWT verification via Supabase, `AuthUser` extraction for protected endpoints |
| `db.py` | Supabase client, batch inserts with retry, upload recording |

### Data Flow

```
1. Startup
   └─ data_loader.load_from_supabase() (fallback: generate_sample_data())
      └─ 8 SKUs × 365 days → Supabase (Postgres) + _store["df"] (in-memory cache)

2. File upload (POST /api/upload)
   └─ data_loader.load_file(file)
      └─ validate schema → replace _store["df"]

3. Forecast request (GET /api/forecast/{sku})
   └─ forecaster.run_forecast(df, sku, horizon)
      └─ AutoARIMA + SeasonalNaive → ensemble → prediction intervals

4. Inventory request (GET /api/inventory)
   └─ inventory_logic.compute_inventory(df)
      └─ per-SKU: SS, ROP, EOQ, alert flag, days of stock

5. AI query (POST /api/ask)
   └─ Build context from inventory + forecast summaries
      └─ ai_advisor.ask(question, context)
         └─ Groq API (Llama 3.3 70B) → markdown answer
```

### Forecasting

**Models:**
- **AutoARIMA** — automatically selects ARIMA order (p,d,q) and seasonal parameters. Captures trend and complex autocorrelation structures.
- **SeasonalNaive** — repeats the value from the same weekday in the prior week. Provides a strong, robust baseline for weekly-seasonal retail data.

**Ensemble:** Final point forecast = average of AutoARIMA and SeasonalNaive predictions. The ensemble smooths out individual model errors and tends to outperform either model alone on retail data.

**Prediction intervals:** 80% and 95% bands are taken from AutoARIMA's distributional output. A wider band at a given horizon signals higher demand uncertainty and should inform safety stock decisions.

**Accuracy:** MAPE (mean absolute percentage error) is estimated on a 30-day held-out window. This gives each SKU an accuracy signal without requiring a separate validation dataset.

**Minimum data requirement:** ≥14 observations per SKU. SKUs with fewer observations return an error.

### Inventory Calculations

```
Safety Stock (SS)    = z × σ_demand × √(lead_time)
Reorder Point (ROP)  = (avg_daily_demand × lead_time) + SS
EOQ                  = √(2 × D_annual × order_cost / holding_cost)
```

| Parameter | Default | Notes |
|-----------|---------|-------|
| `lead_time` | 7 days | Overridable via query param |
| `z` (service level) | 1.65 | Corresponds to 95% service level |
| `holding_cost_pct` | 25% | Annual holding cost as fraction of unit price |
| `order_cost` | $50 | Fixed cost per purchase order |

A SKU is flagged `below_reorder_point: true` when `inventory_on_hand < ROP`. Days of stock = `inventory_on_hand / avg_daily_demand`.

### Storage

**Supabase (Postgres)** is the persistent data store. Sales data and upload metadata are stored in Postgres tables with row-level security (RLS) policies scoped by `user_id`. On startup, the backend loads data from Supabase into an in-memory pandas DataFrame (`_store["df"]`) that serves as a fast read cache. File uploads write through to both Supabase and the in-memory cache.

### Authentication

Protected endpoints (`POST /api/upload`, `POST /api/ask`) require a valid JWT issued by Supabase Auth. The `auth.py` module verifies the token using `SUPABASE_JWT_SECRET` and extracts an `AuthUser` object with `user_id` (from the JWT `sub` claim). When auth is disabled (no JWT secret configured), a default user is used. In production, missing JWT secret triggers a startup warning and all authenticated requests are rejected.

---

## Frontend

Built with **Next.js 16 App Router**, **TypeScript**, **Tailwind CSS v4**, and **Recharts**.

### Component Map

```
page.tsx (main dashboard layout)
├── Sidebar           — navigation, mobile drawer
├── KPICards          — 4 summary metrics
├── ForecastChart     — 14-day demand chart with confidence bands
├── InventoryTable    — per-SKU inventory details
├── AlertPanel        — SKUs below reorder point
└── AskAI             — Groq/Llama natural-language interface
```

### Component Details

| Component | Endpoint | Notes |
|-----------|----------|-------|
| `KPICards` | `GET /api/kpis` | Total SKUs, reorder alerts, forecast accuracy, inventory value |
| `ForecastChart` | `GET /api/forecast/{sku}` | Recharts AreaChart — point forecast + 80%/95% bands |
| `InventoryTable` | `GET /api/inventory` | Tabular view; highlights rows where `below_reorder_point: true` |
| `AlertPanel` | `GET /api/inventory` | Filtered list of alert SKUs |
| `AskAI` | `POST /api/ask` | Text input → backend → Groq/Llama response (markdown rendered) |

### API Client

`src/lib/api.ts` is a thin typed wrapper around `fetch`. All TypeScript interfaces (`ForecastPoint`, `InventoryItem`, `KPIs`, `AskResponse`, etc.) are co-located in the same file for ease of reference.

Base URL is controlled by the `NEXT_PUBLIC_API_URL` environment variable, defaulting to `http://localhost:8000`.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/upload` | Replace in-memory data with uploaded CSV or Excel |
| `GET` | `/api/forecast/{sku}` | Single-SKU forecast — `?horizon=14` |
| `GET` | `/api/forecast/all` | All-SKU forecasts — `?horizon=14` |
| `GET` | `/api/inventory` | Inventory status — `?lead_time=7&service_level=0.95` |
| `GET` | `/api/kpis` | Aggregated KPIs across all SKUs |
| `POST` | `/api/ask` | `{"question": "..."}` → `{"answer": "..."}` |
| `GET` | `/api/health` | `{"status": "ok"}` |

Full OpenAPI schema auto-generated at `http://localhost:8000/docs`.

---

## Design Decisions

**FastAPI + StatsForecast, not a pure JS stack.** The Python ML ecosystem remains the right choice for time-series forecasting. StatsForecast's AutoARIMA implementation is production-tested and performant. FastAPI exposes it as a REST API with near-zero boilerplate.

**Next.js, not Streamlit or Dash.** Streamlit and Dash are excellent for internal data tools and prototypes. A Next.js frontend enables genuine product-quality UI, native TypeScript, component reuse, and one-click deployment to Vercel — the right foundation for a tool meant to be used by non-technical operators.

**Supabase (Postgres) with in-memory cache.** Supabase provides persistent storage, authentication (JWT), and row-level security out of the box. An in-memory pandas DataFrame cache keeps read latency low for forecasting and inventory endpoints. This combination delivers both persistence and performance without requiring a separate caching layer.

**Groq (Llama 3.3 70B) for natural-language queries, not fine-tuning.** Inventory reasoning requires live, up-to-date context (current stock levels, recent demand summaries). Groq's fast inference with Llama 3.3 70B provides strong instruction-following for prompt-based context injection without any model training. The alternative — fine-tuning a smaller model on historical inventory Q&A — would produce a system that is less capable and harder to update.

**Ensemble forecasting.** Neither AutoARIMA nor SeasonalNaive is universally superior across SKU behaviors. AutoARIMA handles complex trend and autocorrelation but can over-fit short series. SeasonalNaive is extremely robust for strongly periodic data. Their average consistently outperforms either individually on retail time series with diverse SKU profiles.

---

## Deployment

| Tier | Recommended Option | Notes |
|------|-------------------|-------|
| Frontend | [Vercel](https://vercel.com) | Auto-deploy from `frontend/` directory; set `NEXT_PUBLIC_API_URL` to backend URL |
| Backend | [Railway](https://railway.app) or [Render](https://render.com) | Python service; set `GROQ_API_KEY` env var for AI advisor |
| Backend (self-hosted) | Docker on any VPS | `docker build` from `backend/` |

---

## Future Architecture

The natural evolution of this architecture:

1. ~~**Persistent database**~~ — **Done.** Supabase (Postgres) is the persistent store with RLS policies and in-memory cache.
2. ~~**Multi-tenant data model**~~ — **Partially done.** `user_id` column exists on uploads and sales data via JWT `sub` claim. Full multi-location support (`store_id` / `warehouse_id`) is the next step.
3. **Background task queue** (Celery + Redis) — move forecast computation off the request path. Pre-compute forecasts on a schedule and serve from cache.
4. **Notification service** — trigger email or Slack alerts when SKUs cross the reorder threshold, rather than requiring a user to check the dashboard.
5. **TimescaleDB migration** — for time-series-optimized queries and hypertable partitioning as data volume grows beyond what standard Postgres handles efficiently.
