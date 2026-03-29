# ForecastHub Test Datasets

Three realistic datasets created for the comprehensive product audit. Each simulates a different retail scenario with real-world pricing and demand patterns.

---

## Dataset A: Small Retail / Grocery Store (`small_retail.csv`)

**Simulates:** Neighborhood grocery or convenience store (15 SKUs, 180 days)

**Sources for pricing:**
- USDA Economic Research Service Food Price Outlook (2025-2026)
- Bureau of Labor Statistics Consumer Price Index (CPI) for food categories
- Real 2025-2026 retail prices: ground beef ~$6.75/lb, eggs ~$3.89/doz, milk ~$4.29/gal

**SKUs (15):**
| SKU | Category | Price | Base Demand/Day |
|-----|----------|-------|-----------------|
| MILK-WHOLE-GAL | Dairy | $4.29 | 45 |
| EGGS-DOZEN-LG | Dairy | $3.89 | 55 |
| BREAD-WHITE-LOAF | Bakery | $3.49 | 38 |
| BANANA-BUNCH | Produce | $1.99 | 60 |
| CHICKEN-BREAST-LB | Meat | $6.75 | 25 |
| RICE-JASMINE-5LB | Dry Goods | $8.49 | 12 |
| PASTA-PENNE-1LB | Dry Goods | $2.29 | 20 |
| CEREAL-CHEERIOS | Dry Goods | $5.99 | 18 |
| WATER-CASE-24PK | Beverages | $6.99 | 30 |
| COFFEE-GROUND-12OZ | Beverages | $12.49 | 15 |
| SODA-COLA-12PK | Beverages | $7.49 | 35 |
| DETERGENT-TIDE-64OZ | Cleaning | $13.99 | 8 |
| PAPER-TOWEL-6ROLL | Cleaning | $9.99 | 14 |
| CHIPS-LAYS-FAM | Snacks | $5.49 | 28 |
| YOGURT-GREEK-6PK | Dairy | $6.29 | 22 |

**Demand patterns:**
- Weekend peaks for chips (+50%), soda (+35%), chicken (+40%), milk (+30%)
- Summer spike for beverages (July-August, +30%)
- Holiday spike for snacks/beverages (Thanksgiving-Christmas, +40%)
- Slight upward trend across all items (+0.03%/day)

**Expected test outcomes:**
- EGGS-DOZEN-LG, CHICKEN-BREAST-LB, COFFEE-GROUND-12OZ should trigger reorder alerts (low starting inventory)
- Beverage SKUs should show clear seasonal forecast patterns
- All 15 SKUs have sufficient history (180 days) for accurate forecasting

---

## Dataset B: Electronics Retailer (`electronics_retailer.csv`)

**Simulates:** Mid-size consumer electronics store like Micro Center (28 SKUs, 365 days)

**Sources for pricing:**
- Consumer Reports laptop pricing data (2025-2026)
- NielsenIQ Consumer Tech market analysis
- Real retail prices: MacBook Air M3 ~$1,099, AirPods Pro ~$249, USB-C cables ~$12.99

**SKUs (28) across 8 categories:**
- Laptops (4): $299-$1,299, demand 3-8/day
- Phones (3): $699-$849, demand 6-12/day
- Monitors (3): $149-$549, demand 4-12/day
- Audio (3): $179-$329, demand 15-25/day
- Accessories (6): $12.99-$34.99, demand 25-120/day
- Peripherals (3): $69-$99, demand 14-22/day
- Storage (3): $9.99-$89.99, demand 20-60/day
- Smart Home (3): $29.99-$199, demand 8-20/day

**Demand patterns:**
- Back-to-school spike (Aug 1 - Sep 1): laptops +60%, peripherals/storage +60%, accessories +30%
- Black Friday week (5 days): laptops/smart home/audio 3.5x, all others 2.5x
- Christmas season (2 weeks before): smart home/audio/phones 2x, all others 1.5x
- Post-Christmas slump: all categories -40% for 2 weeks
- Weekend boost: all categories +25%

**Expected test outcomes:**
- LAPTOP-MACBOOK-AIR-M3 and PHONE-IPHONE-16 should show stockout scenarios (very low inventory)
- Clear Black Friday / Christmas spikes should be visible in forecast charts
- High-volume accessories (USB-C cable 120/day) test scale handling
- Low-volume laptops (3-5/day) test forecast accuracy on sparse data

---

## Dataset C: Stress Test (`stress_test.csv`)

**Simulates:** Deliberately challenging data to test system limits (120 SKUs, mixed history lengths)

**SKU groups:**

| Group | Count | History | Pattern | Tests |
|-------|-------|---------|---------|-------|
| STD-* | 60 | 365 days | Normal seasonal + weekly | Baseline pagination (>50 SKUs) |
| MIN-* | 15 | 15 days | Normal with noise | Minimum viable forecast length |
| NEW-* | 5 | 3-13 days | Normal | Should trigger "< 14 obs" error |
| SPARSE-* | 10 | 365 days | Zero-sale weeks | Intermittent demand handling |
| SPIKE-* | 10 | 365 days | 8 random 15-40x spikes | Outlier robustness |
| DECLINE-* | 10 | 365 days | Linear decline to 20% | Negative trend detection |
| PRICE-LOW-* | 5 | 365 days | Normal, $0.99 | Extreme low price, ~10% missing data |
| PRICE-HIGH-* | 5 | 365 days | Normal, $2,000-$5,000 | Extreme high price, ~10% missing data |

**Edge cases tested:**
1. **Pagination:** 120 SKUs exceeds default page size of 50
2. **Minimum data:** MIN-* SKUs have exactly 15 days (minimum for forecasting)
3. **Forecast errors:** NEW-* SKUs have < 14 days, should return error gracefully
4. **Zero-sale handling:** SPARSE-* SKUs have entire weeks with 0 sales
5. **Outlier robustness:** SPIKE-* SKUs have 8 days with 15-40x normal demand
6. **Trend detection:** DECLINE-* SKUs lose 80% of demand over the year
7. **Price extremes:** $0.99 to $5,000 test inventory value calculations
8. **Missing data:** PRICE-* SKUs have ~10% of rows missing price/category/inventory_on_hand
9. **Performance:** 36,766 total rows test upload and processing speed

**Expected test outcomes:**
- Upload should handle 36K+ rows without timeout
- Pagination should appear in inventory table (120 SKUs / 50 per page = 3 pages)
- NEW-* SKUs should show forecast error messages, not crash the system
- SPARSE-* and SPIKE-* SKUs may have high MAPE but should still produce forecasts
- DECLINE-* SKUs should show downward forecast trend
- Missing optional columns should not cause upload failures

---

## CSV Format

All datasets follow the ForecastHub required format:

```csv
date,sku,quantity_sold,price,category,inventory_on_hand
2025-10-01,MILK-WHOLE-GAL,47,4.29,Dairy,312
```

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| date | YYYY-MM-DD | Yes | ISO 8601 |
| sku | string | Yes | Product identifier |
| quantity_sold | integer >= 0 | Yes | Daily units sold |
| price | float | No | Unit price (USD) |
| category | string | No | Product category |
| inventory_on_hand | integer >= 0 | No | Current stock level |
