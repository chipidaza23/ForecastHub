"""
main.py — ForecastHub FastAPI server.

Run with: uvicorn main:app --reload
"""

import os
from contextlib import asynccontextmanager
from typing import Optional

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import ai_advisor
import data_loader
import forecaster
import inventory_logic

load_dotenv()

# ── In-memory data store ────────────────────────────────────────────────────
# Populated on startup with sample data; replaced when user uploads a file.
_store: dict[str, Optional[pd.DataFrame]] = {"df": None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load sample data on startup so the app works out of the box
    _store["df"] = data_loader.generate_sample_data()
    print("✅  Sample data loaded — 3 SKUs, 365 days")
    yield
    _store["df"] = None


app = FastAPI(
    title="ForecastHub API",
    description="Demand forecasting and inventory management backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
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
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a CSV or Excel file with columns: date, sku, quantity_sold.
    Optional columns: price, category, inventory_on_hand.
    """
    contents = await file.read()
    try:
        df = data_loader.load_file(contents, file.filename or "upload.csv")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    _store["df"] = df
    skus = df["sku"].unique().tolist()
    date_range = {
        "start": str(df["date"].min().date()),
        "end": str(df["date"].max().date()),
    }
    return {
        "message": "File uploaded successfully",
        "rows": len(df),
        "skus": skus,
        "date_range": date_range,
    }


@app.get("/api/forecast/{sku}", summary="Forecast for a single SKU")
async def get_forecast_sku(sku: str, horizon: int = 14):
    """Return a demand forecast for the given SKU (default: 14-day horizon)."""
    df = _require_data()
    if sku not in df["sku"].values:
        raise HTTPException(status_code=404, detail=f"SKU '{sku}' not found in dataset.")
    try:
        result = forecaster.forecast_sku(df, sku, horizon=horizon)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return result


@app.get("/api/forecast/all", summary="Forecasts for all SKUs")
async def get_forecast_all(horizon: int = 14):
    """Return demand forecasts for every SKU in the dataset."""
    df = _require_data()
    results = forecaster.forecast_all(df, horizon=horizon)
    return {"forecasts": results}


@app.get("/api/inventory", summary="Current inventory status with reorder alerts")
async def get_inventory(lead_time: int = 7, service_level: float = 0.95):
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


@app.post("/api/ask", summary="Natural language inventory query (Claude)")
async def ask_question(body: AskRequest):
    """Send a natural language question to Claude and receive inventory advice."""
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
