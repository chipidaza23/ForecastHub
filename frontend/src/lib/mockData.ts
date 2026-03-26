/**
 * mockData.ts — Realistic demo data used when the backend is unreachable.
 * Keeps the dashboard fully populated on Vercel (no backend required).
 */

import type { KPIs, InventoryResponse, InventoryItem, SkuForecast, ForecastPoint } from "./api";

function makeForecastPoints(sku: string, base: number, trend: number): ForecastPoint[] {
  // Deterministic wave offset derived from SKU so each SKU looks distinct
  const seed = sku.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const start = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i + 1);
    const wave = Math.sin((i + seed) * 0.65) * base * 0.09;
    const p = Math.max(1, base + trend * i + wave);
    return {
      date: d.toISOString().slice(0, 10),
      point: +p.toFixed(1),
      lo_80: +(p * 0.87).toFixed(1),
      hi_80: +(p * 1.13).toFixed(1),
      lo_95: +(p * 0.77).toFixed(1),
      hi_95: +(p * 1.23).toFixed(1),
    };
  });
}

const SKU_PARAMS: Record<string, { base: number; trend: number; mape: number }> = {
  "SKU-A001": { base: 85,  trend:  0.3, mape: 7.2 },
  "SKU-A002": { base: 62,  trend: -0.2, mape: 9.8 },
  "SKU-B003": { base: 112, trend:  0.5, mape: 6.4 },
  "SKU-B004": { base: 75,  trend:  0.1, mape: 8.1 },
  "SKU-C005": { base: 55,  trend: -0.1, mape: 11.3 },
  "SKU-C006": { base: 132, trend:  0.8, mape: 5.9 },
  "SKU-D007": { base: 89,  trend:  0.4, mape: 7.7 },
  "SKU-D008": { base: 79,  trend:  0.2, mape: 8.6 },
};

export function getMockForecast(sku: string): SkuForecast {
  const params = SKU_PARAMS[sku] ?? { base: 80, trend: 0, mape: 9.0 };
  return {
    sku,
    horizon: 14,
    forecast: makeForecastPoints(sku, params.base, params.trend),
    mape_30d: params.mape,
  };
}

export function getMockForecastAll(): { forecasts: SkuForecast[] } {
  return { forecasts: Object.keys(SKU_PARAMS).map(getMockForecast) };
}

const MOCK_ITEMS: InventoryItem[] = [
  {
    sku: "SKU-A001",
    avg_daily_demand: 85.2, std_daily_demand: 17.0,
    safety_stock: 120, reorder_point: 400, eoq: 800,
    inventory_on_hand: 2400, below_reorder_point: false,
    days_of_stock: 28, unit_price: 24.99,
  },
  {
    sku: "SKU-A002",
    avg_daily_demand: 62.3, std_daily_demand: 12.5,
    safety_stock: 105, reorder_point: 350, eoq: 650,
    inventory_on_hand: 180, below_reorder_point: true,
    days_of_stock: 3, unit_price: 18.50,
  },
  {
    sku: "SKU-B003",
    avg_daily_demand: 112.4, std_daily_demand: 22.5,
    safety_stock: 150, reorder_point: 500, eoq: 1000,
    inventory_on_hand: 3100, below_reorder_point: false,
    days_of_stock: 27, unit_price: 42.00,
  },
  {
    sku: "SKU-B004",
    avg_daily_demand: 74.8, std_daily_demand: 15.0,
    safety_stock: 125, reorder_point: 420, eoq: 780,
    inventory_on_hand: 290, below_reorder_point: true,
    days_of_stock: 4, unit_price: 31.25,
  },
  {
    sku: "SKU-C005",
    avg_daily_demand: 55.1, std_daily_demand: 11.0,
    safety_stock: 90, reorder_point: 300, eoq: 600,
    inventory_on_hand: 1850, below_reorder_point: false,
    days_of_stock: 33, unit_price: 15.75,
  },
  {
    sku: "SKU-C006",
    avg_daily_demand: 131.7, std_daily_demand: 26.3,
    safety_stock: 180, reorder_point: 600, eoq: 1100,
    inventory_on_hand: 4200, below_reorder_point: false,
    days_of_stock: 32, unit_price: 67.99,
  },
  {
    sku: "SKU-D007",
    avg_daily_demand: 88.5, std_daily_demand: 17.7,
    safety_stock: 240, reorder_point: 800, eoq: 950,
    inventory_on_hand: 620, below_reorder_point: true,
    days_of_stock: 7, unit_price: 88.00,
  },
  {
    sku: "SKU-D008",
    avg_daily_demand: 78.9, std_daily_demand: 15.8,
    safety_stock: 135, reorder_point: 450, eoq: 850,
    inventory_on_hand: 2750, below_reorder_point: false,
    days_of_stock: 35, unit_price: 54.50,
  },
];

export const MOCK_INVENTORY: InventoryResponse = {
  inventory: MOCK_ITEMS,
  alerts: MOCK_ITEMS.filter((i) => i.below_reorder_point),
  total_skus: MOCK_ITEMS.length,
  skus_below_rop: MOCK_ITEMS.filter((i) => i.below_reorder_point).length,
};

export const MOCK_KPIS: KPIs = {
  total_skus: MOCK_ITEMS.length,
  skus_below_rop: MOCK_ITEMS.filter((i) => i.below_reorder_point).length,
  avg_forecast_accuracy: 91.4,
  total_inventory_value: +MOCK_ITEMS.reduce(
    (sum, i) => sum + i.inventory_on_hand * i.unit_price,
    0
  ).toFixed(2),
};
