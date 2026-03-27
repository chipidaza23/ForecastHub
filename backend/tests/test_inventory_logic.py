"""Tests for inventory_logic.py — safety stock, ROP, EOQ, and inventory status."""

import math

import pandas as pd
import pytest

from inventory_logic import (
    compute_inventory_status,
    economic_order_quantity,
    reorder_point,
    safety_stock,
)


class TestSafetyStock:
    def test_basic_formula(self):
        # SS = z * σ * √(LT) = 1.65 * 10 * √7 ≈ 43.64
        result = safety_stock(std_demand=10, lead_time=7, z=1.65)
        expected = 1.65 * 10 * math.sqrt(7)
        assert abs(result - expected) < 0.01

    def test_zero_std_returns_zero(self):
        assert safety_stock(std_demand=0, lead_time=7, z=1.65) == 0.0

    def test_higher_z_gives_higher_ss(self):
        ss_95 = safety_stock(std_demand=10, lead_time=7, z=1.65)
        ss_99 = safety_stock(std_demand=10, lead_time=7, z=2.33)
        assert ss_99 > ss_95


class TestReorderPoint:
    def test_basic_formula(self):
        # ROP = (avg * LT) + SS = (50 * 7) + SS(10, 7, 1.65)
        result = reorder_point(avg_demand=50, std_demand=10, lead_time=7, z=1.65)
        ss = safety_stock(10, 7, 1.65)
        expected = 50 * 7 + ss
        assert abs(result - expected) < 0.01

    def test_zero_demand(self):
        result = reorder_point(avg_demand=0, std_demand=0, lead_time=7, z=1.65)
        assert result == 0.0


class TestEOQ:
    def test_basic_formula(self):
        # EOQ = √(2 * D_annual * S / H) = √(2 * 50*365 * 50 / (10 * 0.25))
        result = economic_order_quantity(
            avg_demand=50, unit_price=10, order_cost=50, holding_cost_pct=0.25
        )
        annual_d = 50 * 365
        expected = math.sqrt(2 * annual_d * 50 / (10 * 0.25))
        assert abs(result - expected) < 0.01

    def test_zero_demand_returns_zero(self):
        result = economic_order_quantity(avg_demand=0, unit_price=10)
        assert result == 0.0

    def test_zero_price_returns_zero(self):
        result = economic_order_quantity(avg_demand=50, unit_price=0)
        assert result == 0.0


class TestComputeInventoryStatus:
    def test_returns_list_of_dicts(self, sample_df):
        status = compute_inventory_status(sample_df)
        assert isinstance(status, list)
        assert len(status) > 0
        assert isinstance(status[0], dict)

    def test_expected_keys(self, sample_df):
        status = compute_inventory_status(sample_df)
        expected_keys = {
            "sku", "avg_daily_demand", "std_daily_demand", "safety_stock",
            "reorder_point", "eoq", "inventory_on_hand",
            "below_reorder_point", "days_of_stock", "unit_price",
        }
        assert set(status[0].keys()) == expected_keys

    def test_one_entry_per_sku(self, sample_df):
        status = compute_inventory_status(sample_df)
        skus_in_result = [s["sku"] for s in status]
        assert len(skus_in_result) == sample_df["sku"].nunique()

    def test_below_reorder_point_flag(self):
        """An item with 0 inventory should be flagged below ROP."""
        df = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=30, freq="D").tolist() * 2,
            "sku": ["LOW"] * 30 + ["HIGH"] * 30,
            "quantity_sold": [10] * 30 + [10] * 30,
            "price": [50.0] * 60,
            "inventory_on_hand": [0] * 30 + [9999] * 30,
        })
        status = compute_inventory_status(df)
        low_item = next(s for s in status if s["sku"] == "LOW")
        high_item = next(s for s in status if s["sku"] == "HIGH")
        assert low_item["below_reorder_point"] is True
        assert high_item["below_reorder_point"] is False

    def test_days_of_stock_calculation(self):
        """days_of_stock = inventory_on_hand / avg_daily_demand."""
        df = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=30, freq="D"),
            "sku": ["TEST"] * 30,
            "quantity_sold": [10] * 30,
            "price": [50.0] * 30,
            "inventory_on_hand": [100] * 30,
        })
        status = compute_inventory_status(df)
        item = status[0]
        assert item["days_of_stock"] == pytest.approx(10.0, abs=0.5)
