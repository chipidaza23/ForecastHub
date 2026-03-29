"""
Generate realistic test datasets for ForecastHub audit.

Uses real-world pricing from USDA/BLS data (2025-2026) and consumer electronics
market data. Demand patterns include weekly seasonality, annual trends, holiday
spikes, and category-specific noise.
"""

import csv
import math
import random
from datetime import date, timedelta

random.seed(2026)


def write_csv(filename: str, records: list[dict], fieldnames: list[str]):
    with open(filename, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)
    print(f"  Written {filename}: {len(records)} rows")


# ── Dataset A: Small Retail / Grocery Store ──────────────────────────────────

def generate_small_retail():
    """
    15 SKUs simulating a neighborhood grocery/convenience store.
    180 days of daily sales. Prices from USDA/BLS 2025-2026 data.
    """
    skus = [
        # Perishables
        {"sku": "MILK-WHOLE-GAL", "price": 4.29, "category": "Dairy", "base_demand": 45, "weekend_mult": 1.3},
        {"sku": "EGGS-DOZEN-LG", "price": 3.89, "category": "Dairy", "base_demand": 55, "weekend_mult": 1.2},
        {"sku": "BREAD-WHITE-LOAF", "price": 3.49, "category": "Bakery", "base_demand": 38, "weekend_mult": 1.1},
        {"sku": "BANANA-BUNCH", "price": 1.99, "category": "Produce", "base_demand": 60, "weekend_mult": 1.15},
        {"sku": "CHICKEN-BREAST-LB", "price": 6.75, "category": "Meat", "base_demand": 25, "weekend_mult": 1.4},
        # Dry goods / pantry
        {"sku": "RICE-JASMINE-5LB", "price": 8.49, "category": "Dry Goods", "base_demand": 12, "weekend_mult": 1.0},
        {"sku": "PASTA-PENNE-1LB", "price": 2.29, "category": "Dry Goods", "base_demand": 20, "weekend_mult": 1.05},
        {"sku": "CEREAL-CHEERIOS", "price": 5.99, "category": "Dry Goods", "base_demand": 18, "weekend_mult": 1.2},
        # Beverages
        {"sku": "WATER-CASE-24PK", "price": 6.99, "category": "Beverages", "base_demand": 30, "weekend_mult": 1.1},
        {"sku": "COFFEE-GROUND-12OZ", "price": 12.49, "category": "Beverages", "base_demand": 15, "weekend_mult": 0.95},
        {"sku": "SODA-COLA-12PK", "price": 7.49, "category": "Beverages", "base_demand": 35, "weekend_mult": 1.35},
        # Cleaning / personal care
        {"sku": "DETERGENT-TIDE-64OZ", "price": 13.99, "category": "Cleaning", "base_demand": 8, "weekend_mult": 1.3},
        {"sku": "PAPER-TOWEL-6ROLL", "price": 9.99, "category": "Cleaning", "base_demand": 14, "weekend_mult": 1.2},
        # Snacks
        {"sku": "CHIPS-LAYS-FAM", "price": 5.49, "category": "Snacks", "base_demand": 28, "weekend_mult": 1.5},
        {"sku": "YOGURT-GREEK-6PK", "price": 6.29, "category": "Dairy", "base_demand": 22, "weekend_mult": 1.1},
    ]

    end_date = date(2026, 3, 29)
    start_date = end_date - timedelta(days=179)
    days = [(start_date + timedelta(days=i)) for i in range(180)]

    records = []
    for item in skus:
        # Start with random inventory; some items will end up low
        inventory = random.randint(80, 600)
        # Items that should trigger alerts get lower starting inventory
        if item["sku"] in ("EGGS-DOZEN-LG", "CHICKEN-BREAST-LB", "COFFEE-GROUND-12OZ"):
            inventory = random.randint(20, 80)

        for day_num, d in enumerate(days):
            dow = d.weekday()  # 0=Mon, 6=Sun
            is_weekend = dow >= 5

            # Base demand with trend (slight upward for most items)
            trend = 1.0 + 0.0003 * day_num
            base = item["base_demand"] * trend

            # Weekly pattern
            weekend_factor = item["weekend_mult"] if is_weekend else 1.0

            # Summer spike for beverages (day ~90-150 = Jul-Aug)
            summer_factor = 1.0
            if item["category"] == "Beverages" and 60 < day_num < 140:
                summer_factor = 1.0 + 0.3 * math.sin(math.pi * (day_num - 60) / 80)

            # Holiday spike for snacks/soda around Thanksgiving/Christmas (day ~150-175)
            holiday_factor = 1.0
            if item["category"] in ("Snacks", "Beverages") and 150 < day_num < 175:
                holiday_factor = 1.4

            # Noise
            noise = random.gauss(1.0, 0.12)

            qty = max(0, round(base * weekend_factor * summer_factor * holiday_factor * noise))

            # Inventory simulation: replenish when low, deplete by sales
            replenish = random.randint(0, round(item["base_demand"] * 1.1))
            inventory = max(0, inventory - qty + replenish)

            records.append({
                "date": d.isoformat(),
                "sku": item["sku"],
                "quantity_sold": qty,
                "price": item["price"],
                "category": item["category"],
                "inventory_on_hand": inventory,
            })

    write_csv("test_data/small_retail.csv", records,
              ["date", "sku", "quantity_sold", "price", "category", "inventory_on_hand"])
    return len(skus)


# ── Dataset B: Electronics Retailer ──────────────────────────────────────────

def generate_electronics():
    """
    28 SKUs simulating a mid-size electronics store (Micro Center-style).
    365 days. Prices from Consumer Reports / market data 2025-2026.
    """
    skus = [
        # Laptops (low volume, high price)
        {"sku": "LAPTOP-DELL-15", "price": 749.99, "category": "Laptops", "base_demand": 5, "variance": 0.3},
        {"sku": "LAPTOP-HP-14-CHROMEBOOK", "price": 299.99, "category": "Laptops", "base_demand": 8, "variance": 0.25},
        {"sku": "LAPTOP-MACBOOK-AIR-M3", "price": 1099.99, "category": "Laptops", "base_demand": 4, "variance": 0.35},
        {"sku": "LAPTOP-LENOVO-THINKPAD", "price": 1299.99, "category": "Laptops", "base_demand": 3, "variance": 0.3},
        # Phones
        {"sku": "PHONE-IPHONE-16", "price": 799.99, "category": "Phones", "base_demand": 12, "variance": 0.25},
        {"sku": "PHONE-SAMSUNG-S25", "price": 849.99, "category": "Phones", "base_demand": 10, "variance": 0.2},
        {"sku": "PHONE-PIXEL-9", "price": 699.99, "category": "Phones", "base_demand": 6, "variance": 0.3},
        # Monitors
        {"sku": "MONITOR-27IN-4K", "price": 349.99, "category": "Monitors", "base_demand": 7, "variance": 0.25},
        {"sku": "MONITOR-34IN-ULTRAWIDE", "price": 549.99, "category": "Monitors", "base_demand": 4, "variance": 0.3},
        {"sku": "MONITOR-24IN-1080P", "price": 149.99, "category": "Monitors", "base_demand": 12, "variance": 0.2},
        # Headphones
        {"sku": "HEADPHONE-AIRPODS-PRO", "price": 249.99, "category": "Audio", "base_demand": 25, "variance": 0.2},
        {"sku": "HEADPHONE-SONY-WH1000XM5", "price": 329.99, "category": "Audio", "base_demand": 15, "variance": 0.25},
        {"sku": "EARBUDS-SAMSUNG-BUDS3", "price": 179.99, "category": "Audio", "base_demand": 18, "variance": 0.2},
        # Accessories (high volume, low price)
        {"sku": "CABLE-USB-C-6FT", "price": 12.99, "category": "Accessories", "base_demand": 120, "variance": 0.15},
        {"sku": "CABLE-LIGHTNING-3FT", "price": 14.99, "category": "Accessories", "base_demand": 80, "variance": 0.15},
        {"sku": "CABLE-HDMI-2.1-6FT", "price": 19.99, "category": "Accessories", "base_demand": 55, "variance": 0.15},
        {"sku": "CHARGER-USB-C-65W", "price": 34.99, "category": "Accessories", "base_demand": 40, "variance": 0.2},
        {"sku": "ADAPTER-USB-HUB-7PORT", "price": 29.99, "category": "Accessories", "base_demand": 25, "variance": 0.2},
        {"sku": "MOUSEPAD-XL-GAMING", "price": 24.99, "category": "Accessories", "base_demand": 35, "variance": 0.2},
        # Peripherals
        {"sku": "KEYBOARD-MECH-TKL", "price": 89.99, "category": "Peripherals", "base_demand": 18, "variance": 0.25},
        {"sku": "MOUSE-LOGITECH-MX3S", "price": 99.99, "category": "Peripherals", "base_demand": 22, "variance": 0.2},
        {"sku": "WEBCAM-1080P-LOGITECH", "price": 69.99, "category": "Peripherals", "base_demand": 14, "variance": 0.25},
        # Storage
        {"sku": "SSD-SAMSUNG-1TB", "price": 89.99, "category": "Storage", "base_demand": 20, "variance": 0.2},
        {"sku": "USB-DRIVE-128GB", "price": 9.99, "category": "Storage", "base_demand": 60, "variance": 0.15},
        {"sku": "MICROSD-256GB", "price": 24.99, "category": "Storage", "base_demand": 30, "variance": 0.2},
        # Smart Home
        {"sku": "ECHO-DOT-5TH", "price": 49.99, "category": "Smart Home", "base_demand": 20, "variance": 0.25},
        {"sku": "SMARTPLUG-4PACK", "price": 29.99, "category": "Smart Home", "base_demand": 15, "variance": 0.2},
        {"sku": "RING-DOORBELL-4", "price": 199.99, "category": "Smart Home", "base_demand": 8, "variance": 0.3},
    ]

    end_date = date(2026, 3, 29)
    start_date = end_date - timedelta(days=364)
    days = [(start_date + timedelta(days=i)) for i in range(365)]

    # Key holiday dates (approximate day indices)
    # Back to school: ~day 120-150 (Aug 1 - Sep 1)
    # Black Friday: ~day 240 (late Nov)
    # Christmas: ~day 260 (late Dec)
    bf_day = None
    xmas_day = None
    bts_start = None
    bts_end = None
    for i, d in enumerate(days):
        if d.month == 11 and d.day == 28:
            bf_day = i
        if d.month == 12 and d.day == 25:
            xmas_day = i
        if d.month == 8 and d.day == 1:
            bts_start = i
        if d.month == 9 and d.day == 1:
            bts_end = i

    records = []
    for item in skus:
        inventory = random.randint(50, 2000)
        # Some items will have stockouts
        if item["sku"] in ("LAPTOP-MACBOOK-AIR-M3", "PHONE-IPHONE-16"):
            inventory = random.randint(5, 20)

        for day_num, d in enumerate(days):
            dow = d.weekday()
            base = item["base_demand"]

            # Slight overall trend (electronics trend slightly up)
            trend = 1.0 + 0.0002 * day_num

            # Weekend boost (more shopping on weekends)
            weekend_factor = 1.25 if dow >= 5 else 1.0

            # Back to school (laptops, peripherals, storage spike)
            bts_factor = 1.0
            if bts_start and bts_end and bts_start <= day_num <= bts_end:
                if item["category"] in ("Laptops", "Peripherals", "Storage"):
                    bts_factor = 1.6
                elif item["category"] == "Accessories":
                    bts_factor = 1.3

            # Black Friday / Cyber Monday (huge spike for 5 days)
            bf_factor = 1.0
            if bf_day and bf_day - 1 <= day_num <= bf_day + 4:
                bf_factor = 3.5 if item["category"] in ("Laptops", "Smart Home", "Audio") else 2.5

            # Christmas season (2 weeks before)
            xmas_factor = 1.0
            if xmas_day and xmas_day - 14 <= day_num <= xmas_day:
                xmas_factor = 2.0 if item["category"] in ("Smart Home", "Audio", "Phones") else 1.5

            # Post-Christmas slump
            post_xmas = 1.0
            if xmas_day and xmas_day < day_num <= xmas_day + 14:
                post_xmas = 0.6

            # Noise
            noise = random.gauss(1.0, item["variance"])

            qty = max(0, round(base * trend * weekend_factor * bts_factor * bf_factor * xmas_factor * post_xmas * noise))

            # Inventory simulation
            restock_rate = item["base_demand"] * 1.05
            replenish = random.randint(0, round(restock_rate))
            inventory = max(0, inventory - qty + replenish)

            records.append({
                "date": d.isoformat(),
                "sku": item["sku"],
                "quantity_sold": qty,
                "price": item["price"],
                "category": item["category"],
                "inventory_on_hand": inventory,
            })

    write_csv("test_data/electronics_retailer.csv", records,
              ["date", "sku", "quantity_sold", "price", "category", "inventory_on_hand"])
    return len(skus)


# ── Dataset C: Stress Test ───────────────────────────────────────────────────

def generate_stress_test():
    """
    120 SKUs designed to stress-test the system.
    Edge cases: very short histories, zero-sale periods, extreme spikes, negative trends,
    missing optional columns, price extremes.
    """
    end_date = date(2026, 3, 29)
    records = []
    sku_count = 0

    # Group 1: 60 normal SKUs with 365 days (baseline)
    for i in range(60):
        sku = f"STD-{i+1:04d}"
        base_demand = random.uniform(5, 200)
        price = round(random.uniform(2.99, 499.99), 2)
        start = end_date - timedelta(days=364)
        inventory = random.randint(50, 3000)

        for day_num in range(365):
            d = start + timedelta(days=day_num)
            seasonal = 1.0 + 0.2 * math.sin(2 * math.pi * day_num / 365)
            weekly = 1.0 + 0.15 * math.sin(2 * math.pi * d.weekday() / 7)
            noise = random.gauss(1.0, 0.15)
            qty = max(0, round(base_demand * seasonal * weekly * noise))
            inventory = max(0, inventory - qty + random.randint(0, round(base_demand)))
            records.append({
                "date": d.isoformat(),
                "sku": sku,
                "quantity_sold": qty,
                "price": price,
                "category": f"Category-{chr(65 + i % 10)}",
                "inventory_on_hand": inventory,
            })
        sku_count += 1

    # Group 2: 15 SKUs with minimum viable history (exactly 15 days)
    for i in range(15):
        sku = f"MIN-{i+1:04d}"
        base_demand = random.uniform(10, 50)
        price = round(random.uniform(5, 100), 2)
        start = end_date - timedelta(days=14)
        inventory = random.randint(20, 200)

        for day_num in range(15):
            d = start + timedelta(days=day_num)
            noise = random.gauss(1.0, 0.2)
            qty = max(0, round(base_demand * noise))
            inventory = max(0, inventory - qty + random.randint(0, round(base_demand)))
            records.append({
                "date": d.isoformat(),
                "sku": sku,
                "quantity_sold": qty,
                "price": price,
                "category": "Short-History",
                "inventory_on_hand": inventory,
            })
        sku_count += 1

    # Group 3: 5 SKUs with < 14 days (should trigger forecast error)
    for i in range(5):
        sku = f"NEW-{i+1:04d}"
        base_demand = random.uniform(5, 30)
        price = round(random.uniform(10, 50), 2)
        days_of_data = random.randint(3, 13)
        start = end_date - timedelta(days=days_of_data - 1)
        inventory = random.randint(50, 200)

        for day_num in range(days_of_data):
            d = start + timedelta(days=day_num)
            qty = max(0, round(base_demand * random.gauss(1.0, 0.15)))
            inventory = max(0, inventory - qty + random.randint(0, round(base_demand)))
            records.append({
                "date": d.isoformat(),
                "sku": sku,
                "quantity_sold": qty,
                "price": price,
                "category": "New-Product",
                "inventory_on_hand": inventory,
            })
        sku_count += 1

    # Group 4: 10 SKUs with zero-sale weeks (intermittent demand)
    for i in range(10):
        sku = f"SPARSE-{i+1:04d}"
        base_demand = random.uniform(20, 80)
        price = round(random.uniform(10, 300), 2)
        start = end_date - timedelta(days=364)
        inventory = random.randint(100, 1000)

        for day_num in range(365):
            d = start + timedelta(days=day_num)
            # Zero sales for random 2-week stretches
            week_num = day_num // 7
            is_dead_week = (week_num % 7 == 0) or (week_num % 11 == 0)
            if is_dead_week:
                qty = 0
            else:
                noise = random.gauss(1.0, 0.2)
                qty = max(0, round(base_demand * noise))
            inventory = max(0, inventory - qty + random.randint(0, round(base_demand * 0.8)))
            records.append({
                "date": d.isoformat(),
                "sku": sku,
                "quantity_sold": qty,
                "price": price,
                "category": "Intermittent",
                "inventory_on_hand": inventory,
            })
        sku_count += 1

    # Group 5: 10 SKUs with extreme spikes (event-driven demand)
    for i in range(10):
        sku = f"SPIKE-{i+1:04d}"
        base_demand = random.uniform(5, 30)
        price = round(random.uniform(15, 200), 2)
        start = end_date - timedelta(days=364)
        inventory = random.randint(100, 500)
        spike_days = set(random.sample(range(365), 8))  # 8 random spike days

        for day_num in range(365):
            d = start + timedelta(days=day_num)
            if day_num in spike_days:
                qty = round(base_demand * random.uniform(15, 40))  # 15-40x normal
            else:
                qty = max(0, round(base_demand * random.gauss(1.0, 0.15)))
            inventory = max(0, inventory - qty + random.randint(0, round(base_demand * 1.2)))
            records.append({
                "date": d.isoformat(),
                "sku": sku,
                "quantity_sold": qty,
                "price": price,
                "category": "Event-Driven",
                "inventory_on_hand": inventory,
            })
        sku_count += 1

    # Group 6: 10 SKUs with declining trend (dying product line)
    for i in range(10):
        sku = f"DECLINE-{i+1:04d}"
        base_demand = random.uniform(50, 150)
        price = round(random.uniform(20, 500), 2)
        start = end_date - timedelta(days=364)
        inventory = random.randint(500, 3000)

        for day_num in range(365):
            d = start + timedelta(days=day_num)
            # Linear decline to ~20% of original by end
            decline = 1.0 - 0.8 * (day_num / 365)
            noise = random.gauss(1.0, 0.15)
            qty = max(0, round(base_demand * decline * noise))
            inventory = max(0, inventory - qty + random.randint(0, round(base_demand * decline * 0.9)))
            records.append({
                "date": d.isoformat(),
                "sku": sku,
                "quantity_sold": qty,
                "price": price,
                "category": "Declining",
                "inventory_on_hand": inventory,
            })
        sku_count += 1

    # Group 7: 10 SKUs with extreme prices ($0.99 and $5000)
    for i in range(10):
        is_cheap = i < 5
        sku = f"PRICE-{'LOW' if is_cheap else 'HIGH'}-{i+1:04d}"
        price = 0.99 if is_cheap else round(random.uniform(2000, 5000), 2)
        base_demand = random.uniform(100, 500) if is_cheap else random.uniform(1, 5)
        start = end_date - timedelta(days=364)
        inventory = random.randint(200, 5000) if is_cheap else random.randint(5, 30)

        for day_num in range(365):
            d = start + timedelta(days=day_num)
            noise = random.gauss(1.0, 0.2)
            qty = max(0, round(base_demand * noise))
            replenish = random.randint(0, round(base_demand * 1.1))
            inventory = max(0, inventory - qty + replenish)

            # For some rows, omit optional columns (price, category, inventory_on_hand)
            record = {
                "date": d.isoformat(),
                "sku": sku,
                "quantity_sold": qty,
            }
            # Include price/category/inventory for most rows but omit for ~10%
            if random.random() > 0.1:
                record["price"] = price
            if random.random() > 0.1:
                record["category"] = "Budget" if is_cheap else "Premium"
            if random.random() > 0.1:
                record["inventory_on_hand"] = inventory
            else:
                record["price"] = record.get("price", "")
                record["category"] = record.get("category", "")
                record["inventory_on_hand"] = ""

            records.append(record)
        sku_count += 1

    write_csv("test_data/stress_test.csv", records,
              ["date", "sku", "quantity_sold", "price", "category", "inventory_on_hand"])
    return sku_count


# ── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("Generating ForecastHub test datasets...\n")

    n1 = generate_small_retail()
    print(f"  Dataset A: {n1} SKUs (small retail / grocery)\n")

    n2 = generate_electronics()
    print(f"  Dataset B: {n2} SKUs (electronics retailer)\n")

    n3 = generate_stress_test()
    print(f"  Dataset C: {n3} SKUs (stress test)\n")

    print("Done.")
