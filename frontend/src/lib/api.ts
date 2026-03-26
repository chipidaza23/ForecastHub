/**
 * api.ts — HTTP client for the ForecastHub FastAPI backend.
 * Base URL: http://localhost:8000
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface ForecastPoint {
  date: string;
  point: number;
  lo_80: number;
  hi_80: number;
  lo_95: number;
  hi_95: number;
}

export interface SkuForecast {
  sku: string;
  horizon: number;
  forecast: ForecastPoint[];
  mape_30d: number | null;
  error?: string;
}

export interface InventoryItem {
  sku: string;
  avg_daily_demand: number;
  std_daily_demand: number;
  safety_stock: number;
  reorder_point: number;
  eoq: number;
  inventory_on_hand: number;
  below_reorder_point: boolean;
  days_of_stock: number | null;
  unit_price: number;
}

export interface InventoryResponse {
  inventory: InventoryItem[];
  alerts: InventoryItem[];
  total_skus: number;
  skus_below_rop: number;
}

export interface KPIs {
  total_skus: number;
  skus_below_rop: number;
  avg_forecast_accuracy: number | null;
  total_inventory_value: number;
}

export interface AskResponse {
  answer: string;
  model: string;
  tokens_used: number;
}

export interface UploadResponse {
  message: string;
  rows: number;
  skus: string[];
  date_range: { start: string; end: string };
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const api = {
  /** Upload a CSV/Excel file */
  uploadFile: async (file: File): Promise<UploadResponse> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/api/upload`, { method: "POST", body: form });
    if (!res.ok) throw new Error(`Upload failed: ${await res.text()}`);
    return res.json();
  },

  /** Forecast for a single SKU */
  forecastSku: (sku: string, horizon = 14) =>
    request<SkuForecast>(`/api/forecast/${encodeURIComponent(sku)}?horizon=${horizon}`),

  /** Forecasts for all SKUs */
  forecastAll: (horizon = 14) =>
    request<{ forecasts: SkuForecast[] }>(`/api/forecast/all?horizon=${horizon}`),

  /** Inventory status + reorder alerts */
  getInventory: (leadTime = 7, serviceLevel = 0.95) =>
    request<InventoryResponse>(
      `/api/inventory?lead_time=${leadTime}&service_level=${serviceLevel}`
    ),

  /** Summary KPIs */
  getKpis: () => request<KPIs>("/api/kpis"),

  /** Natural language question */
  ask: (question: string) =>
    request<AskResponse>("/api/ask", {
      method: "POST",
      body: JSON.stringify({ question }),
    }),

  /** Health check */
  health: () => request<{ status: string; data_loaded: boolean }>("/api/health"),
};
