"""Shared test fixtures for ForecastHub backend tests."""

import sys
from pathlib import Path

import pandas as pd
import pytest

# Ensure the backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from data_loader import generate_sample_data


@pytest.fixture(scope="session")
def sample_df() -> pd.DataFrame:
    """Generate sample data once for the whole test session."""
    return generate_sample_data(n_skus=3, days=60, seed=42)


@pytest.fixture()
def small_df() -> pd.DataFrame:
    """A minimal DataFrame with 2 SKUs and 30 days — fast for unit tests."""
    return generate_sample_data(n_skus=2, days=30, seed=99)
