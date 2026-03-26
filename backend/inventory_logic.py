"""
inventory_logic.py — Safety stock, reorder points, EOQ, and alert generation.

Formulas:
  Safety Stock : SS = z * σ_demand * √(lead_time)
  Reorder Point: ROP = (avg_daily_demand * lead_time) + safety_stock
  EOQ          : EOQ = √(2 * D * S / H)

Default parameters:
  lead_time        = 7 days
  service_level    = 0.95  →  z = 1.65
  holding_cost_pct = 0.25  (25 % of unit price per year)
  order_cost       = 50    (fixed cost per order, USD)
"""

import math
from typing import Optional

import pandas as pd

# ── Default parameters ──────────────────────────────────────────────────────
DEFAULT_LEAD_TIME = 7          # days
DEFAULT_Z = 1.65               # z-score for 95 % service level
DEFAULT_HOLDING_COST_PCT = 0.25
DEFAULT_ORDER_COST = 50.0      # USD per order
LOOKBACK_DAYS = 30             # days used to compute avg / std demand


def _demand_stats(df: pd.DataFrame, sku: str, lookback: int = LOOKBACK_DAYS) -> tuple[float, float]:
    """Return (avg_daily_demand, std_daily_demand) over the last `lookback` days."""
    sku_df = df[df["sku"] == sku].sort_values("date").tail(lookback)
    if sku_df.empty:
        return 0.0, 0.0
    avg = float(sku_df["quantity_sold"].mean())
    std = float(sku_df["quantity_sold"].std(ddof=1)) if len(sku_df) > 1 else avg * 0.2
    return avg, std


def safety_stock(
    std_demand: float,
    lead_time: int = DEFAULT_LEAD_TIME,
    z: float = DEFAULT_Z,
) -> float:
    """SS = z * σ_demand * √(lead_time)"""
    return z * std_demand * math.sqrt(lead_time)


def reorder_point(
    avg_demand: float,
    std_demand: float,
    lead_time: int = DEFAULT_LEAD_TIME,
    z: float = DEFAULT_Z,
) -> float:
    """ROP = (avg_daily_demand * lead_time) + safety_stock"""
    ss = safety_stock(std_demand, lead_time, z)
    return avg_demand * lead_time + ss


def economic_order_quantity(
    avg_demand: float,
    unit_price: float,
    order_cost: float = DEFAULT_ORDER_COST,
    holding_cost_pct: float = DEFAULT_HOLDING_COST_PCT,
) -> float:
    """EOQ = √(2 * D_annual * S / H)"""
    annual_demand = avg_demand * 365
    holding_cost = unit_price * holding_cost_pct
    if holding_cost <= 0 or annual_demand <= 0:
        return 0.0
    return math.sqrt(2 * annual_demand * order_cost / holding_cost)


def compute_inventory_status(
    df: pd.DataFrame,
    lead_time: int = DEFAULT_LEAD_TIME,
    z: float = DEFAULT_Z,
    order_cost: float = DEFAULT_ORDER_COST,
    holding_cost_pct: float = DEFAULT_HOLDING_COST_PCT,
) -> list[dict]:
    """
    For every SKU compute inventory KPIs and flag reorder alerts.

    Returns a list of dicts:
      sku, avg_daily_demand, std_daily_demand, safety_stock, reorder_point,
      eoq, inventory_on_hand, below_reorder_point, days_of_stock, unit_price
    """
    results = []

    for sku in df["sku"].unique():
        avg_d, std_d = _demand_stats(df, sku)

        # Latest inventory on hand
        sku_df = df[df["sku"] == sku].sort_values("date")
        inv_on_hand: float = 0.0
        unit_price: float = 1.0

        if "inventory_on_hand" in df.columns:
            inv_on_hand = float(sku_df["inventory_on_hand"].iloc[-1])
        if "price" in df.columns:
            unit_price = float(sku_df["price"].iloc[-1])

        ss = round(safety_stock(std_d, lead_time, z), 1)
        rop = round(reorder_point(avg_d, std_d, lead_time, z), 1)
        eoq = round(economic_order_quantity(avg_d, unit_price, order_cost, holding_cost_pct), 1)

        days_of_stock: Optional[float] = None
        if avg_d > 0:
            days_of_stock = round(inv_on_hand / avg_d, 1)

        results.append(
            {
                "sku": sku,
                "avg_daily_demand": round(avg_d, 2),
                "std_daily_demand": round(std_d, 2),
                "safety_stock": ss,
                "reorder_point": rop,
                "eoq": eoq,
                "inventory_on_hand": round(inv_on_hand, 1),
                "below_reorder_point": inv_on_hand <= rop,
                "days_of_stock": days_of_stock,
                "unit_price": unit_price,
            }
        )

    return results
