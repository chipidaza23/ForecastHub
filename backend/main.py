"""
main.py — ForecastHub FastAPI server.

Run with: uvicorn main:app --reload
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

import pandas as pd
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

import ai_advisor
import data_loader
import db
import forecaster
import inventory_logic
from auth import AuthUser, verify_token

load_dotenv()

logger = logging.getLogger(__name__)

# ── In-memory data store (cache — Supabase is source of truth) ────────────
_store: dict[str, Optional[pd.DataFrame]] = {"df": None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warn if running in production without auth
    if os.getenv("ENVIRONMENT") == "production" and not os.getenv("SUPABASE_JWT_SECRET"):
        logger.warning(
            "Running in production without SUPABASE_JWT_SECRET. "
            "Authenticated endpoints will reject all requests."
        )

    # Try to load from Supabase first; fall back to sample data
    try:
        df = data_loader.load_from_supabase()
        if df is not None and not df.empty:
            _store["df"] = df
            skus = df["sku"].nunique()
            print(f"✅  Loaded {len(df)} rows ({skus} SKUs) from Supabase")
        else:
            raise ValueError("No data in Supabase")
    except Exception as exc:
        print(f"⚠️  Supabase load failed ({exc}), generating sample data…")
        _store["df"] = data_loader.generate_sample_data()
        # Persist sample data to Supabase
        try:
            data_loader.save_to_supabase(_store["df"])
            print("✅  Sample data saved to Supabase — 8 SKUs, 365 days")
        except Exception as save_exc:
            print(f"⚠️  Could not save to Supabase ({save_exc}), using in-memory only")
    yield
    _store["df"] = None


limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="ForecastHub API",
    description="Demand forecasting and inventory management backend",
    version="0.3.0",
    lifespan=lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — allow local dev and production Vercel domains
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
# Add production origin from env if set
prod_origin = os.getenv("FRONTEND_URL")
if prod_origin:
    ALLOWED_ORIGINS.append(prod_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ─────────────────────────────────────────────────────────────────

def _require_data() -> pd.DataFrame:
    if _store["df"] is None:
        raise HTTPException(status_code=400, detail="No data loaded. Upload a file first.")
    return _store["df"]


# ── Schemas ──────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    question: str


# ── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/api/upload", summary="Upload a CSV or Excel sales file")
@limiter.limit("5/minute")
async def upload_file(request: Request, file: UploadFile = File(...), user: AuthUser = Depends(verify_token)):
    """
    Upload a CSV or Excel file with columns: date, sku, quantity_sold.
    Optional columns: price, category, inventory_on_hand.
    """
    contents = await file.read()
    MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(contents) / 1024 / 1024:.1f} MB). Maximum allowed: 10 MB.",
        )
    try:
        df = data_loader.load_file(contents, file.filename or "upload.csv")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # Persist to Supabase
    try:
        rows_saved = data_loader.save_to_supabase(df, user_id=user.user_id)
    except Exception as exc:
        print(f"⚠️  Supabase save failed: {exc}")
        rows_saved = len(df)

    _store["df"] = df
    skus = df["sku"].unique().tolist()
    date_range = {
        "start": str(df["date"].min().date()),
        "end": str(df["date"].max().date()),
    }

    # Log the upload
    try:
        db.record_upload(
            user_id=user.user_id,
            filename=file.filename or "upload.csv",
            rows=rows_saved,
            skus=skus,
            date_range=date_range,
        )
    except Exception:
        pass

    return {
        "message": "File uploaded successfully",
        "rows": len(df),
        "skus": skus,
        "date_range": date_range,
    }


@app.get("/api/forecast/all", summary="Forecasts for all SKUs")
async def get_forecast_all(horizon: int = Query(default=14, ge=1, le=365)):
    """Return demand forecasts for every SKU in the dataset."""
    df = _require_data()
    results = forecaster.forecast_all(df, horizon=horizon)
    return {"forecasts": results}


@app.get("/api/forecast/{sku}", summary="Forecast for a single SKU")
@limiter.limit("30/minute")
async def get_forecast_sku(request: Request, sku: str, horizon: int = Query(default=14, ge=1, le=365)):
    """Return a demand forecast for the given SKU (default: 14-day horizon)."""
    df = _require_data()
    if sku not in df["sku"].values:
        raise HTTPException(status_code=404, detail=f"SKU '{sku}' not found in dataset.")
    try:
        result = forecaster.forecast_sku(df, sku, horizon=horizon)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return result


@app.get("/api/history/{sku}", summary="Historical sales data for a single SKU")
async def get_history(sku: str, days: int = Query(default=14, ge=1, le=3650)):
    """Return the last N days of actual sales data for a SKU."""
    df = _require_data()
    if sku not in df["sku"].values:
        raise HTTPException(status_code=404, detail=f"SKU '{sku}' not found in dataset.")

    sku_df = df[df["sku"] == sku].sort_values("date").tail(days)
    records = [
        {
            "date": row["date"].strftime("%Y-%m-%d"),
            "quantity_sold": float(row["quantity_sold"]),
        }
        for _, row in sku_df.iterrows()
    ]
    return {"sku": sku, "days": days, "history": records}


@app.get("/api/inventory", summary="Current inventory status with reorder alerts")
async def get_inventory(lead_time: int = Query(default=7, ge=1, le=365), service_level: float = Query(default=0.95, ge=0.5, le=0.9999)):
    """
    Return per-SKU inventory status including safety stock, reorder point,
    EOQ, current inventory, and whether the SKU is below its reorder point.
    """
    df = _require_data()
    z = _service_level_to_z(service_level)
    status = inventory_logic.compute_inventory_status(df, lead_time=lead_time, z=z)
    alerts = [s for s in status if s["below_reorder_point"]]
    return {
        "inventory": status,
        "alerts": alerts,
        "total_skus": len(status),
        "skus_below_rop": len(alerts),
    }


@app.post("/api/ask", summary="Natural language inventory query (Groq)")
@limiter.limit("10/minute")
async def ask_question(request: Request, body: AskRequest, user: AuthUser = Depends(verify_token)):
    """Send a natural language question to the AI advisor."""
    df = _require_data()
    inv_status = inventory_logic.compute_inventory_status(df)

    # Build a lightweight forecast summary for context
    forecast_summaries = []
    for sku in df["sku"].unique():
        try:
            fc = forecaster.forecast_sku(df, sku, horizon=14)
            avg_forecast = sum(r["point"] for r in fc["forecast"]) / len(fc["forecast"])
            forecast_summaries.append(
                {
                    "sku": sku,
                    "avg_14d_forecast": round(avg_forecast, 2),
                    "mape_30d": fc.get("mape_30d"),
                }
            )
        except Exception:
            pass

    try:
        result = ai_advisor.ask(body.question, inv_status, forecast_summaries)
    except EnvironmentError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"AI error: {exc}")

    return result


@app.get("/api/kpis", summary="Summary KPIs")
async def get_kpis():
    """
    Return high-level KPIs:
      - total_skus
      - skus_below_rop
      - avg_forecast_accuracy (100 - avg_mape)
      - total_inventory_value
    """
    df = _require_data()
    inv_status = inventory_logic.compute_inventory_status(df)
    skus_below_rop = sum(1 for s in inv_status if s["below_reorder_point"])

    # Forecast accuracy
    mapes = []
    for sku in df["sku"].unique():
        try:
            fc = forecaster.forecast_sku(df, sku, horizon=14)
            if fc.get("mape_30d") is not None:
                mapes.append(fc["mape_30d"])
        except Exception:
            pass
    avg_accuracy = round(100 - (sum(mapes) / len(mapes)), 1) if mapes else None

    # Total inventory value
    total_value = sum(
        s["inventory_on_hand"] * s["unit_price"] for s in inv_status
    )

    return {
        "total_skus": len(inv_status),
        "skus_below_rop": skus_below_rop,
        "avg_forecast_accuracy": avg_accuracy,
        "total_inventory_value": round(total_value, 2),
    }


@app.get("/api/health")
async def health():
    return {"status": "ok", "data_loaded": _store["df"] is not None}


# ── Utility ──────────────────────────────────────────────────────────────────

def _service_level_to_z(service_level: float) -> float:
    """Approximate z-score lookup for common service levels."""
    table = {0.90: 1.28, 0.95: 1.65, 0.99: 2.33}
    return min(table.items(), key=lambda kv: abs(kv[0] - service_level))[1]
