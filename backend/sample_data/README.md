# Sample Data

## Using the Built-in Generator

ForecastHub ships with a synthetic data generator that creates 3 SKUs × 365 days
of realistic daily sales data (with trend, weekly seasonality, and noise).

This loads automatically when the backend starts — no files needed.

## Using Real Data: M5 Competition Dataset

For a more challenging real-world test, use the
[M5 Forecasting Competition dataset](https://www.kaggle.com/competitions/m5-forecasting-accuracy/data)
from Kaggle (Walmart daily sales, ~30 k time series).

### Download steps

1. Install the Kaggle CLI:  `pip install kaggle`
2. Place your `kaggle.json` credentials in `~/.kaggle/`
3. Download:
   ```bash
   kaggle competitions download -c m5-forecasting-accuracy
   unzip m5-forecasting-accuracy.zip -d m5/
   ```

### Reshape to ForecastHub format

The M5 dataset is in wide format. Run this snippet to convert it:

```python
import pandas as pd

sales = pd.read_csv("m5/sales_train_validation.csv")
id_cols = ["id", "item_id", "dept_id", "cat_id", "store_id", "state_id"]
day_cols = [c for c in sales.columns if c.startswith("d_")]

long = sales.melt(id_vars=id_cols, value_vars=day_cols,
                  var_name="d", value_name="quantity_sold")

calendar = pd.read_csv("m5/calendar.csv")[["d", "date"]]
long = long.merge(calendar, on="d")
long = long.rename(columns={"item_id": "sku"})
long[["date", "sku", "quantity_sold"]].to_csv("m5_ready.csv", index=False)
```

Upload `m5_ready.csv` via the **Upload** button in the dashboard.

## Required CSV Format

| Column | Type | Required |
|--------|------|----------|
| `date` | YYYY-MM-DD | ✅ |
| `sku` | string | ✅ |
| `quantity_sold` | integer ≥ 0 | ✅ |
| `price` | float | optional |
| `category` | string | optional |
| `inventory_on_hand` | integer ≥ 0 | optional |
