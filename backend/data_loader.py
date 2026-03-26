"""
data_loader.py — CSV/Excel ingestion, validation, and sample data generation.
"""

import io
import math
import random
from datetime import date, timedelta
from typing import Optional

import pandas as pd


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


def generate_sample_data(
    n_skus: int = 3,
    days: int = 365,
    seed: int = 42,
) -> pd.DataFrame:
    """
    Generate synthetic daily sales data with trend, weekly seasonality, and noise.

    Returns a DataFrame with columns: date, sku, quantity_sold, price, category, inventory_on_hand.
    """
    random.seed(seed)
    rng = random.Random(seed)

    skus = [f"SKU-{1000 + i}" for i in range(n_skus)]
    categories = ["Electronics", "Apparel", "Home & Garden"]
    prices = [49.99, 29.99, 19.99]
    base_demands = [15.0, 30.0, 45.0]

    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)
    date_range = [start_date + timedelta(days=i) for i in range(days)]

    records = []
    for idx, sku in enumerate(skus):
        base = base_demands[idx]
        trend_per_day = rng.uniform(0.005, 0.02) * base / days
        inventory = rng.randint(200, 500)

        for day_num, d in enumerate(date_range):
            # Trend component
            trend = trend_per_day * day_num

            # Weekly seasonality: higher on weekdays (Mon=0 … Sun=6)
            dow = d.weekday()
            seasonal_weekly = 1.0 + 0.3 * math.sin(2 * math.pi * dow / 7)

            # Annual seasonality (peak around day 330 = late November)
            seasonal_annual = 1.0 + 0.4 * math.sin(2 * math.pi * (day_num - 90) / 365)

            # Random noise (±20 %)
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
