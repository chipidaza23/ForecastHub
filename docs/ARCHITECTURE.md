# Architecture

## Overview

ForecastHub is a two-tier web application:

```
Browser  ──►  Next.js 14 (frontend)  ──►  FastAPI (backend)  ──►  StatsForecast / Claude API
```

---

## Backend (`/backend`)

| File | Responsibility |
|------|---------------|
| `main.py` | FastAPI app, route definitions, CORS, lifespan startup |
| `data_loader.py` | File parsing (CSV/Excel), column validation, sample data generation |
| `forecaster.py` | StatsForecast wrapper — AutoARIMA + SeasonalNaive, prediction intervals, MAPE |
| `inventory_logic.py` | Safety stock, reorder point, EOQ, alert flagging |
| `ai_advisor.py` | Claude API integration for natural language queries |

### Data flow

1. On startup, `data_loader.generate_sample_data()` creates 3 SKUs × 365 days of synthetic data and stores it in memory.
2. Users can replace it by uploading a CSV/Excel via `POST /api/upload`.
3. All downstream endpoints (`/api/forecast`, `/api/inventory`, `/api/kpis`, `/api/ask`) read from the same in-memory DataFrame.

### Forecasting

- **Models**: AutoARIMA (captures trend + seasonality automatically) and SeasonalNaive (strong baseline for weekly-seasonal data).
- **Ensemble**: Point forecast = average of AutoARIMA and SeasonalNaive.
- **Intervals**: 80 % and 95 % prediction intervals from AutoARIMA.
- **Accuracy**: MAPE estimated via a 30-day hold-out window.

### Inventory calculations

```
Safety Stock (SS)   = z × σ_demand × √(lead_time)
Reorder Point (ROP) = (avg_daily_demand × lead_time) + SS
EOQ                 = √(2 × D_annual × order_cost / holding_cost)
```

Defaults: `lead_time=7d`, `z=1.65` (95 % service level), `holding_cost_pct=0.25`.

---

## Frontend (`/frontend`)

Built with **Next.js 14 App Router**, **TypeScript**, **Tailwind CSS**, and **Recharts**.

| Component | Purpose |
|-----------|---------|
| `Sidebar` | Navigation — works on desktop and mobile (drawer) |
| `KPICards` | Four summary cards: SKUs, alerts, accuracy, inventory value |
| `ForecastChart` | 14-day demand forecast with 80 %/95 % confidence bands |
| `InventoryTable` | SKU-level table with on-hand qty, ROP, SS, EOQ, days of stock |
| `AlertPanel` | List of SKUs currently below their reorder point |
| `AskAI` | Free-text input → Claude → markdown answer |

### API client (`src/lib/api.ts`)

Thin wrapper around `fetch` pointing at `http://localhost:8000`. All types are defined in the same file.

---

## Data model

Minimum CSV schema accepted by the backend:

| Column | Type | Notes |
|--------|------|-------|
| `date` | ISO 8601 date | `YYYY-MM-DD` |
| `sku` | string | Product identifier |
| `quantity_sold` | integer ≥ 0 | Daily units sold |
| `price` | float | Optional — used for inventory value & EOQ |
| `category` | string | Optional — for future filtering |
| `inventory_on_hand` | integer ≥ 0 | Optional — current stock level |

---

## Deployment

| Tier | Option |
|------|--------|
| Frontend | Vercel (automatic from `frontend/` directory) |
| Backend | Railway, Render, or Docker on any VPS |

Set `NEXT_PUBLIC_API_URL` in the Vercel dashboard to the Railway backend URL.
