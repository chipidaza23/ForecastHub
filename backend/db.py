"""
db.py — Supabase client helpers: admin (service-key) and user (anon + JWT).

Tables:
  sales_data (id, user_id, date, sku, quantity_sold, price, category, inventory_on_hand, created_at)
  uploads    (id, user_id, filename, rows, skus, date_range, created_at)
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache

import pandas as pd
from supabase import Client, create_client

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_admin_client() -> Client:
    """Return a cached Supabase client using the SERVICE_KEY (bypasses RLS)."""
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise EnvironmentError(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment."
        )
    return create_client(url, key)


def get_user_client(jwt_token: str) -> Client:
    """Return a Supabase client that applies Row Level Security for the given user.

    Uses the anon key and injects the user's JWT so RLS policies apply.
    Falls back to admin client if SUPABASE_ANON_KEY is not configured yet.
    """
    url = os.getenv("SUPABASE_URL")
    anon_key = os.getenv("SUPABASE_ANON_KEY")
    if not url or not anon_key:
        return get_admin_client()
    client = create_client(url, anon_key)
    # Set the user's JWT so Supabase applies RLS policies
    client.postgrest.auth(jwt_token)
    return client


def load_dataframe(user_id: str = "default") -> pd.DataFrame | None:
    """Load all sales_data rows for a user into a pandas DataFrame."""
    client = get_admin_client()
    response = (
        client.table("sales_data")
        .select("*")
        .eq("user_id", user_id)
        .order("sku")
        .order("date")
        .execute()
    )
    if not response.data:
        return None

    df = pd.DataFrame(response.data)
    df["date"] = pd.to_datetime(df["date"])
    df["quantity_sold"] = pd.to_numeric(df["quantity_sold"], errors="coerce").fillna(0)
    return df


def save_dataframe(df: pd.DataFrame, user_id: str = "default") -> dict:
    """
    Write a pandas DataFrame into the sales_data table.
    Replaces all existing rows for the given user_id.
    Returns dict with rows_inserted and rows_failed counts.
    """
    client = get_admin_client()

    # Delete existing data for this user
    client.table("sales_data").delete().eq("user_id", user_id).execute()

    # Prepare records for insert
    records = []
    for _, row in df.iterrows():
        record = {
            "user_id": user_id,
            "date": str(row["date"].date()) if hasattr(row["date"], "date") else str(row["date"]),
            "sku": str(row["sku"]),
            "quantity_sold": float(row["quantity_sold"]),
        }
        if "price" in df.columns and pd.notna(row.get("price")):
            record["price"] = float(row["price"])
        if "category" in df.columns and pd.notna(row.get("category")):
            record["category"] = str(row["category"])
        if "inventory_on_hand" in df.columns and pd.notna(row.get("inventory_on_hand")):
            record["inventory_on_hand"] = float(row["inventory_on_hand"])
        records.append(record)

    # Insert in batches of 500 with per-batch error handling
    batch_size = 500
    rows_inserted = 0
    rows_failed = 0
    for i in range(0, len(records), batch_size):
        batch = records[i : i + batch_size]
        try:
            client.table("sales_data").insert(batch).execute()
            rows_inserted += len(batch)
        except Exception as exc:
            rows_failed += len(batch)
            logger.error(
                "Batch insert failed (rows %d-%d): %s",
                i, i + len(batch) - 1, exc,
            )

    return {"rows_inserted": rows_inserted, "rows_failed": rows_failed}


def record_upload(
    user_id: str,
    filename: str,
    rows: int,
    skus: list[str],
    date_range: dict[str, str],
) -> None:
    """Log an upload event."""
    client = get_admin_client()
    client.table("uploads").insert(
        {
            "user_id": user_id,
            "filename": filename,
            "rows": rows,
            "skus": skus,
            "date_range": date_range,
        }
    ).execute()
