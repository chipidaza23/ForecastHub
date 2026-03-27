"""
data_loader.py — CSV/Excel ingestion, validation, sample data generation, and Supabase persistence.
"""

from __future__ import annotations

import io
import math
import random
from datetime import date, timedelta
from typing import Optional

import pandas as pd

import db


REQUIRED_COLUMNS = {"date", "sku", "quantity_sold"}
OPTIONAL_COLUMNS = {"price", "category", "inventory_on_hand"}


def load_file(contents: bytes, filename: str) -> pd.DataFrame:
    """Parse uploaded CSV or Excel file into a DataFrame."""
    if filename.endswith(".csv"):
        df = pd.read_csv(io.BytesIO(contents))
    elif filename.endswith((".xlsx", ".xls")):
        df = pd.read_excel(io.BytesIO(contents))
    else:
        raise ValueError(f"Unsupported file type: {filename}. Use CSV or Excel.")
    return validate(df)


def validate(df: pd.DataFrame) -> pd.DataFrame:
    """Validate required columns and coerce types."""
    cols = {c.lower().strip() for c in df.columns}
    missing = REQUIRED_COLUMNS - cols
    if missing:
        raise ValueError(f"Missing required columns: {missing}. Found: {set(df.columns)}")

    # Normalise column names to lowercase
    df.columns = [c.lower().strip() for c in df.columns]

    df["date"] = pd.to_datetime(df["date"])
    df["quantity_sold"] = pd.to_numeric(df["quantity_sold"], errors="coerce").fillna(0).clip(lower=0)
    df["sku"] = df["sku"].astype(str).str.strip()

    df = df.sort_values(["sku", "date"]).reset_index(drop=True)
    return df


def save_to_supabase(df: pd.DataFrame, user_id: str = "default") -> int:
    """Persist a DataFrame to Supabase. Returns row count."""
    return db.save_dataframe(df, user_id=user_id)


def load_from_supabase(user_id: str = "default") -> pd.DataFrame | None:
    """Load persisted data from Supabase. Returns None if no data."""
    return db.load_dataframe(user_id=user_id)


def generate_sample_data(
    n_skus: int = 8,
    days: int = 365,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generate synthetic daily sales data with trend, weekly seasonality, and noise.

    Returns a DataFrame with columns: date, sku, quantity_sold, price, category, inventory_on_hand.
    """
    random.seed(seed)
    rng = random.Random(seed)

    skus = [
        "SKU-A001", "SKU-A002", "SKU-B003", "SKU-B004",
        "SKU-C005", "SKU-C006", "SKU-D007", "SKU-D008",
    ][:n_skus]
    categories = [
        "Electronics", "Electronics", "Apparel", "Apparel",
        "Home & Garden", "Home & Garden", "Food & Bev", "Food & Bev",
    ][:n_skus]
    prices = [89.99, 64.99, 119.99, 79.99, 59.99, 139.99, 94.99, 84.99][:n_skus]
    base_demands = [85.0, 62.0, 112.0, 75.0, 55.0, 132.0, 89.0, 79.0][:n_skus]

    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)
    date_range = [start_date + timedelta(days=i) for i in range(days)]

    records = []
    for idx, sku in enumerate(skus):
        base = base_demands[idx]
        trend_per_day = rng.uniform(0.005, 0.02) * base / days
        inventory = rng.randint(200, 5000)

        for day_num, d in enumerate(date_range):
            # Trend component
            trend = trend_per_day * day_num

            # Weekly seasonality: higher on weekdays (Mon=0 … Sun=6)
            dow = d.weekday()
            seasonal_weekly = 1.0 + 0.3 * math.sin(2 * math.pi * dow / 7)

            # Annual seasonality (peak around day 330 = late November)
            seasonal_annual = 1.0 + 0.4 * math.sin(2 * math.pi * (day_num - 90) / 365)

            # Random noise (±10 %)
            noise = rng.gauss(1.0, 0.10)

            qty = max(0, round((base + trend) * seasonal_weekly * seasonal_annual * noise))

            inventory = max(0, inventory - qty + rng.randint(0, round(base * 1.2)))

            records.append(
                {
                    "date": d.isoformat(),
                    "sku": sku,
                    "quantity_sold": qty,
                    "price": prices[idx],
                    "category": categories[idx],
                    "inventory_on_hand": inventory,
                }
            )

    df = pd.DataFrame(records)
    return validate(df)
