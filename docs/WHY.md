# Why I Built ForecastHub

## The problem

Most inventory management tools fall into one of two buckets:

1. **Too expensive** — enterprise platforms like SAP IBP or Blue Yonder cost tens of thousands of dollars per year and require dedicated consultants to configure.
2. **Too simplistic** — spreadsheets with `=AVERAGE(last_30_days)` that ignore seasonality, give no confidence intervals, and have no actionable reorder logic.

Small and mid-sized retailers, DTC brands, and marketplace sellers are stuck in the middle. They have enough data to benefit from real forecasting, but can't justify enterprise software costs.

## The gap

Modern ML forecasting libraries have become genuinely excellent and completely free:
- **StatsForecast** (Nixtla) delivers AutoARIMA and ensemble methods in a few lines of Python.
- **LLMs** can now reason over structured inventory data and answer plain-English questions.

But there is no clean, open-source project that wraps these into a usable dashboard. Most tutorials stop at a Jupyter notebook.

## What ForecastHub does

ForecastHub bridges that gap:

- **Real forecasts with uncertainty** — not just a naive average, but AutoARIMA + SeasonalNaive with 80 % / 95 % confidence bands.
- **Inventory logic baked in** — safety stock, reorder points, and EOQ are computed automatically from the forecast data.
- **AI-powered queries** — ask "which SKUs should I reorder this week?" in plain English and get a data-grounded answer from Claude.
- **Zero cost to run** — the only paid component is the Anthropic API (optional). Everything else is open-source.

## Design decisions

**Why FastAPI + StatsForecast instead of a pure JS stack?**
The Python ML ecosystem is still unmatched for time-series. FastAPI makes it trivial to expose that as a REST API.

**Why Next.js instead of a Python dashboard (Streamlit/Dash)?**
Streamlit and Dash are great for prototypes but feel like internal tools. A Next.js frontend allows a real product-quality UI and easy deployment to Vercel.

**Why in-memory storage instead of a database?**
To keep the self-hosted setup as simple as possible — `uvicorn main:app --reload` and you're running. A PostgreSQL migration is the obvious next step for persistence.

**Why Claude for NLQ instead of fine-tuning a model?**
Inventory reasoning requires up-to-date context (current stock levels, recent demand). Claude's long context window and tool-calling make it ideal for injecting live data at query time without any training.

## What's next

- [ ] Time-series database backend (TimescaleDB or DuckDB)
- [ ] Multi-store / multi-warehouse support
- [ ] Automated reorder email/Slack notifications
- [ ] ABC-XYZ inventory classification
- [ ] Supplier lead-time tracking
- [ ] TimesFM integration for zero-shot forecasting on new SKUs
