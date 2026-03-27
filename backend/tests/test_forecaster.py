"""Tests for forecaster.py — demand forecasting with StatsForecast."""

import pytest

from forecaster import forecast_all, forecast_sku


class TestForecastSku:
    def test_returns_expected_keys(self, sample_df):
        sku = sample_df["sku"].unique()[0]
        result = forecast_sku(sample_df, sku, horizon=7)
        assert set(result.keys()) == {"sku", "horizon", "forecast", "mape_30d"}

    def test_forecast_length_matches_horizon(self, sample_df):
        sku = sample_df["sku"].unique()[0]
        for h in [7, 14]:
            result = forecast_sku(sample_df, sku, horizon=h)
            assert len(result["forecast"]) == h

    def test_forecast_point_structure(self, sample_df):
        sku = sample_df["sku"].unique()[0]
        result = forecast_sku(sample_df, sku, horizon=7)
        point = result["forecast"][0]
        expected_keys = {"date", "point", "lo_80", "hi_80", "lo_95", "hi_95"}
        assert set(point.keys()) == expected_keys

    def test_confidence_intervals_outer_ordered(self, sample_df):
        """lo_95 <= lo_80 and hi_80 <= hi_95 for each forecast point."""
        sku = sample_df["sku"].unique()[0]
        result = forecast_sku(sample_df, sku, horizon=7)
        for point in result["forecast"]:
            assert point["lo_95"] <= point["lo_80"], f"lo_95 > lo_80: {point}"
            assert point["hi_80"] <= point["hi_95"], f"hi_80 > hi_95: {point}"

    def test_all_values_non_negative(self, sample_df):
        sku = sample_df["sku"].unique()[0]
        result = forecast_sku(sample_df, sku, horizon=7)
        for point in result["forecast"]:
            assert point["point"] >= 0
            assert point["lo_80"] >= 0
            assert point["lo_95"] >= 0

    def test_insufficient_data_raises(self):
        """SKU with fewer than 14 observations should raise ValueError."""
        import pandas as pd

        df = pd.DataFrame({
            "date": pd.date_range("2024-01-01", periods=10, freq="D"),
            "sku": ["SHORT"] * 10,
            "quantity_sold": [5] * 10,
        })
        with pytest.raises(ValueError, match="fewer than 14"):
            forecast_sku(df, "SHORT")

    def test_mape_is_float_or_none(self, sample_df):
        sku = sample_df["sku"].unique()[0]
        result = forecast_sku(sample_df, sku, horizon=7)
        assert result["mape_30d"] is None or isinstance(result["mape_30d"], float)


class TestForecastAll:
    def test_returns_one_result_per_sku(self, sample_df):
        results = forecast_all(sample_df, horizon=7)
        skus = sample_df["sku"].unique()
        assert len(results) == len(skus)

    def test_each_result_has_sku_key(self, sample_df):
        results = forecast_all(sample_df, horizon=7)
        for r in results:
            assert "sku" in r
