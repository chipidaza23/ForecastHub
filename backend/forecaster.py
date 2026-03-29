"""
forecaster.py — Demand forecasting engine using StatsForecast.

Models: AutoARIMA + SeasonalNaive (ensemble-ready).
Returns point forecasts with 80 % and 95 % prediction intervals.
"""

from typing import Optional

import pandas as pd
from statsforecast import StatsForecast
from statsforecast.models import AutoARIMA, SeasonalNaive


def _prepare_nixtla_df(df: pd.DataFrame, sku: str) -> pd.DataFrame:
    """Convert raw data for a single SKU into the Nixtla long format."""
    sku_df = df[df["sku"] == sku][["date", "quantity_sold"]].copy()
    sku_df = sku_df.sort_values("date").drop_duplicates("date")
    sku_df = sku_df.rename(columns={"date": "ds", "quantity_sold": "y"})
    sku_df["unique_id"] = sku
    sku_df["ds"] = pd.to_datetime(sku_df["ds"])
    return sku_df[["unique_id", "ds", "y"]]


def forecast_sku(
    df: pd.DataFrame,
    sku: str,
    horizon: int = 14,
    freq: str = "D",
) -> dict:
    """
    Forecast demand for a single SKU.

    Returns:
        {
            "sku": str,
            "horizon": int,
            "forecast": [{"date": "YYYY-MM-DD", "point": float,
                          "lo_80": float, "hi_80": float,
                          "lo_95": float, "hi_95": float}, ...],
            "mape_30d": float | None,
        }
    """
    nixtla_df = _prepare_nixtla_df(df, sku)

    if len(nixtla_df) < 14:
        raise ValueError(f"SKU '{sku}' has fewer than 14 observations — cannot forecast.")

    models = [
        AutoARIMA(season_length=7),
        SeasonalNaive(season_length=7),
    ]

    sf = StatsForecast(models=models, freq=freq, n_jobs=-1)
    sf.fit(nixtla_df)

    forecast_df = sf.predict(h=horizon, level=[80, 95])
    forecast_df = forecast_df.reset_index()

    # Average AutoARIMA and SeasonalNaive point forecasts
    records = []
    for _, row in forecast_df.iterrows():
        arima_pt = row.get("AutoARIMA", 0)
        naive_pt = row.get("SeasonalNaive", 0)
        point = round((arima_pt + naive_pt) / 2, 2)

        lo_80 = round(row.get("AutoARIMA-lo-80", row.get("SeasonalNaive-lo-80", point * 0.8)), 2)
        hi_80 = round(row.get("AutoARIMA-hi-80", row.get("SeasonalNaive-hi-80", point * 1.2)), 2)
        lo_95 = round(row.get("AutoARIMA-lo-95", row.get("SeasonalNaive-lo-95", point * 0.7)), 2)
        hi_95 = round(row.get("AutoARIMA-hi-95", row.get("SeasonalNaive-hi-95", point * 1.3)), 2)

        records.append(
            {
                "date": row["ds"].strftime("%Y-%m-%d"),
                "point": max(0.0, point),
                "lo_80": max(0.0, lo_80),
                "hi_80": max(0.0, hi_80),
                "lo_95": max(0.0, lo_95),
                "hi_95": max(0.0, hi_95),
            }
        )

    mape = _mape_last_n(nixtla_df, sf, n=30, freq=freq)

    return {
        "sku": sku,
        "horizon": horizon,
        "forecast": records,
        "mape_30d": mape,
    }


def forecast_all(df: pd.DataFrame, horizon: int = 14) -> list[dict]:
    """Forecast all SKUs in the dataset."""
    results = []
    for sku in df["sku"].unique():
        try:
            results.append(forecast_sku(df, sku, horizon=horizon))
        except Exception as exc:
            results.append({"sku": sku, "error": str(exc)})
    return results


def _mape_last_n(nixtla_df: pd.DataFrame, sf: StatsForecast, n: int = 30, freq: str = "D") -> Optional[float]:
    """
    Estimate MAPE by holding out the last n observations.
    Returns None if there is insufficient data.
    """
    if len(nixtla_df) < n + 14:
        return None

    train = nixtla_df.iloc[:-n].copy()
    actuals = nixtla_df.iloc[-n:].copy()

    try:
        sf_cv = StatsForecast(
            models=[AutoARIMA(season_length=7)],
            freq=freq,
            n_jobs=1,
        )
        sf_cv.fit(train)
        preds = sf_cv.predict(h=n)
        preds = preds.reset_index()

        merged = actuals.merge(preds[["ds", "AutoARIMA"]], on="ds", how="inner")
        if merged.empty or (merged["y"] == 0).all():
            return None

        nonzero = merged[merged["y"] > 0]
        mape = float((abs(nonzero["y"] - nonzero["AutoARIMA"]) / nonzero["y"]).mean() * 100)
        return round(mape, 2)
    except Exception:
        return None
