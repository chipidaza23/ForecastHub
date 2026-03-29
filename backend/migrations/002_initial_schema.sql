-- 002_initial_schema.sql
-- ForecastHub initial table schema for Supabase (PostgreSQL).
-- Apply via Supabase SQL Editor or CLI.

CREATE TABLE IF NOT EXISTS sales_data (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           text NOT NULL,
    date              date NOT NULL,
    sku               text NOT NULL,
    quantity_sold     numeric NOT NULL DEFAULT 0,
    price             numeric,
    category          text,
    inventory_on_hand numeric,
    created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uploads (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     text NOT NULL,
    filename    text NOT NULL,
    rows        int NOT NULL,
    skus        jsonb,
    date_range  jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Indexes for query patterns used in db.py
CREATE INDEX IF NOT EXISTS idx_sales_data_user_sku_date ON sales_data (user_id, sku, date);
CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads (user_id);
