"""Tests for data_loader.py — file parsing, validation, and sample data generation."""

import io

import pandas as pd
import pytest

from data_loader import generate_sample_data, load_file, validate


class TestGenerateSampleData:
    def test_returns_dataframe(self):
        df = generate_sample_data(n_skus=2, days=30, seed=1)
        assert isinstance(df, pd.DataFrame)

    def test_correct_shape(self):
        df = generate_sample_data(n_skus=3, days=60, seed=1)
        assert len(df) == 3 * 60
        assert df["sku"].nunique() == 3

    def test_required_columns_present(self):
        df = generate_sample_data(n_skus=1, days=10, seed=1)
        for col in ("date", "sku", "quantity_sold"):
            assert col in df.columns

    def test_optional_columns_present(self):
        df = generate_sample_data(n_skus=1, days=10, seed=1)
        for col in ("price", "category", "inventory_on_hand"):
            assert col in df.columns

    def test_quantity_non_negative(self):
        df = generate_sample_data(n_skus=3, days=90, seed=1)
        assert (df["quantity_sold"] >= 0).all()

    def test_date_column_is_datetime(self):
        df = generate_sample_data(n_skus=1, days=10, seed=1)
        assert pd.api.types.is_datetime64_any_dtype(df["date"])

    def test_sorted_by_sku_and_date(self):
        df = generate_sample_data(n_skus=3, days=30, seed=1)
        assert df.equals(df.sort_values(["sku", "date"]).reset_index(drop=True))

    def test_deterministic_with_seed(self):
        df1 = generate_sample_data(n_skus=2, days=10, seed=42)
        df2 = generate_sample_data(n_skus=2, days=10, seed=42)
        pd.testing.assert_frame_equal(df1, df2)


class TestLoadFile:
    def test_load_csv(self):
        csv_content = b"date,sku,quantity_sold\n2024-01-01,SKU-1,10\n2024-01-02,SKU-1,15"
        df = load_file(csv_content, "test.csv")
        assert len(df) == 2
        assert "sku" in df.columns

    def test_unsupported_format_raises(self):
        with pytest.raises(ValueError, match="Unsupported file type"):
            load_file(b"data", "test.txt")


class TestValidate:
    def test_missing_column_raises(self):
        df = pd.DataFrame({"date": ["2024-01-01"], "sku": ["A"]})  # missing quantity_sold
        with pytest.raises(ValueError, match="Missing required columns"):
            validate(df)

    def test_coerces_date_to_datetime(self):
        df = pd.DataFrame({
            "date": ["2024-01-01", "2024-01-02"],
            "sku": ["A", "A"],
            "quantity_sold": [10, 20],
        })
        result = validate(df)
        assert pd.api.types.is_datetime64_any_dtype(result["date"])

    def test_coerces_quantity_to_numeric(self):
        df = pd.DataFrame({
            "date": ["2024-01-01"],
            "sku": ["A"],
            "quantity_sold": ["not_a_number"],
        })
        result = validate(df)
        assert result["quantity_sold"].iloc[0] == 0.0

    def test_negative_quantity_clipped_to_zero(self):
        df = pd.DataFrame({
            "date": ["2024-01-01"],
            "sku": ["A"],
            "quantity_sold": [-5],
        })
        result = validate(df)
        assert result["quantity_sold"].iloc[0] == 0.0

    def test_normalizes_column_names(self):
        df = pd.DataFrame({
            "Date ": ["2024-01-01"],
            " SKU": ["A"],
            "Quantity_Sold": [10],
        })
        result = validate(df)
        assert "date" in result.columns
        assert "sku" in result.columns
        assert "quantity_sold" in result.columns
