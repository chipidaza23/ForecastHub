# ForecastHub

**Open-source demand forecasting and inventory management dashboard.**

> Upload your sales data → get 14-day forecasts with confidence bands → ask Claude "what should I reorder today?"

---

<!-- Screenshot placeholder — replace with actual screenshot after first run -->
![ForecastHub Dashboard](docs/screenshot.png)

---

## Features

- **Demand forecasting** — AutoARIMA + SeasonalNaive ensemble with 80 % / 95 % prediction intervals
- **Inventory health** — safety stock, reorder points, and EOQ computed per SKU
- **Reorder alerts** — instant flags when inventory drops below the reorder point
- **AI Advisor** — ask natural-language questions about your inventory, powered by Claude
- **File upload** — drop in any CSV or Excel file; works out of the box with sample data
- **KPI cards** — total SKUs, items below ROP, forecast accuracy, and inventory value at a glance
- **Open-source** — MIT license, self-hostable, no vendor lock-in

---

## Quick start

### 1. Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file and add your Anthropic key (optional — needed for AI Advisor)
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY=sk-ant-...

# Start the server (sample data loads automatically)
uvicorn main:app --reload
```

API is now running at **http://localhost:8000**.
Interactive docs: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Dashboard is now at **http://localhost:3000**.

---

## Data format

Upload any CSV or Excel file with these columns:

| Column | Required | Notes |
|--------|----------|-------|
| `date` | Yes | `YYYY-MM-DD` |
| `sku` | Yes | Product identifier |
| `quantity_sold` | Yes | Daily units sold |
| `price` | No | Unit price (used for EOQ and inventory value) |
| `category` | No | Product category |
| `inventory_on_hand` | No | Current stock level |

See `backend/sample_data/README.md` for instructions on using the M5 dataset.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Backend API | Python 3.11+, FastAPI, Uvicorn |
| Forecasting | StatsForecast (Nixtla) — AutoARIMA, SeasonalNaive |
| Data | pandas, openpyxl |
| AI | Anthropic Claude API |
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Charts | Recharts |
| Icons | Lucide React |
| Deployment | Vercel (frontend), Railway / local (backend) |

---

## Project structure

```
ForecastHub/
├── backend/
│   ├── main.py              # FastAPI app + all endpoints
│   ├── forecaster.py        # StatsForecast engine
│   ├── data_loader.py       # CSV/Excel ingestion + sample data
│   ├── inventory_logic.py   # Safety stock, ROP, EOQ
│   ├── ai_advisor.py        # Claude integration
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/             # Next.js App Router pages
│       ├── components/      # React components
│       └── lib/api.ts       # Backend API client
└── docs/
    ├── ARCHITECTURE.md      # System design
    └── WHY.md               # Motivation
```

---

## Why I built this

Most inventory tools are either too expensive (enterprise SaaS) or too simple (Excel averages). ForecastHub fills the gap with proper statistical forecasting, inventory math, and AI-powered queries — all open-source and self-hostable.

Read the full story in [docs/WHY.md](docs/WHY.md).

---

## Deployment

**Frontend → Vercel**

```bash
cd frontend
npx vercel --prod
```

Set `NEXT_PUBLIC_API_URL` to your backend URL in the Vercel dashboard.

**Backend → Railway / Render**

Push `backend/` to a Python service. Set the `ANTHROPIC_API_KEY` environment variable.

---

## Contributing

Pull requests are welcome. Please open an issue first to discuss major changes.

---

## License

MIT © 2024 — see [LICENSE](LICENSE)
