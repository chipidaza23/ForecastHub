"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Download } from "lucide-react";
import { api, type SkuForecast, type HistoryPoint } from "@/lib/api";

interface Props {
  sku?: string;
}

const HORIZONS = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
];

export default function ForecastChart({ sku }: Props) {
  const [forecast, setForecast] = useState<SkuForecast | null>(null);
  const [history, setHistory] = useState<HistoryPoint[] | null>(null);
  const [allSkus, setAllSkus] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>(sku ?? "");
  const [horizon, setHorizon] = useState(14);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load SKU list on mount
  useEffect(() => {
    api.getInventory(7, 0.95, 200, 0).then((inv) => {
      const skus = inv.inventory.map((i) => i.sku);
      setAllSkus(skus);
      if (!selected && skus.length) setSelected(skus[0]);
    });
  }, []);

  // Fetch forecast + history together, cancel stale requests
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      api.forecastSku(selected, horizon, controller.signal),
      api.historySku(selected, 14, controller.signal),
    ])
      .then(([fc, hist]) => {
        if (!controller.signal.aborted) {
          setForecast(fc);
          setHistory(hist.history);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setError(e.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [selected, horizon]);

  // Merge history + forecast into unified chart data
  const chartData = useMemo(() => {
    const points: Record<string, number | string | undefined>[] = [];

    if (history) {
      for (const h of history) {
        points.push({ date: h.date.slice(5), Actual: h.quantity_sold });
      }
    }

    if (forecast) {
      for (const f of forecast.forecast) {
        const dateLabel = f.date.slice(5);
        const existing = points.find((p) => p.date === dateLabel);
        const forecastFields = {
          Forecast: +f.point.toFixed(1),
          "80% Low": +f.lo_80.toFixed(1),
          "80% High": +f.hi_80.toFixed(1),
          "95% Low": +f.lo_95.toFixed(1),
          "95% High": +f.hi_95.toFixed(1),
        };
        if (existing) {
          Object.assign(existing, forecastFields);
        } else {
          points.push({ date: dateLabel, ...forecastFields });
        }
      }
    }

    return points.length > 0 ? points : undefined;
  }, [history, forecast]);

  const exportCSV = () => {
    if (!chartData) return;
    const header = "Date,Actual,Forecast,80% Low,80% High,95% Low,95% High\n";
    const rows = chartData
      .map(
        (p) =>
          `${p.date},${p.Actual ?? ""},${p.Forecast ?? ""},${p["80% Low"] ?? ""},${p["80% High"] ?? ""},${p["95% Low"] ?? ""},${p["95% High"] ?? ""}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forecast-${selected}-${horizon}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Demand Forecast</h2>
          {forecast?.mape_30d !== undefined && forecast.mape_30d !== null && (
            <p className="text-xs text-gray-400">
              MAPE (last 30d):{" "}
              <span className="font-medium text-gray-600">{forecast.mape_30d}%</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <select
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {HORIZONS.map((h) => (
              <option key={h.value} value={h.value}>
                {h.label}
              </option>
            ))}
          </select>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {allSkus.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            onClick={exportCSV}
            disabled={!chartData}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors"
            title="Export CSV"
            aria-label="Export forecast as CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 py-8 text-center">{error}</p>
      )}

      {loading && (
        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
          Loading forecast…
        </div>
      )}

      {!loading && !error && !chartData && (
        <div className="h-64 flex items-center justify-center text-sm text-gray-400">
          No forecast data available
        </div>
      )}

      {!loading && !error && chartData && (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="ci95" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="ci80" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
            />
            <Legend verticalAlign="top" height={28} iconType="line" wrapperStyle={{ fontSize: 11 }} />
            {/* Historical actuals */}
            <Area
              type="monotone"
              dataKey="Actual"
              stroke="#10b981"
              strokeWidth={2}
              fill="none"
              dot={{ r: 2, fill: "#10b981" }}
              connectNulls={false}
            />
            {/* 95% CI band */}
            <Area
              type="monotone"
              dataKey="95% High"
              stroke="none"
              fill="url(#ci95)"
              legendType="none"
            />
            <Area
              type="monotone"
              dataKey="95% Low"
              stroke="none"
              fill="#fff"
              legendType="none"
            />
            {/* 80% CI band */}
            <Area
              type="monotone"
              dataKey="80% High"
              stroke="none"
              fill="url(#ci80)"
              legendType="none"
            />
            <Area
              type="monotone"
              dataKey="80% Low"
              stroke="none"
              fill="#fff"
              legendType="none"
            />
            {/* Point forecast */}
            <Area
              type="monotone"
              dataKey="Forecast"
              stroke="#6366f1"
              strokeWidth={2.5}
              fill="none"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
