"use client";

import { useEffect, useState } from "react";
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
import { api, type SkuForecast } from "@/lib/api";

interface Props {
  sku?: string;
}

export default function ForecastChart({ sku }: Props) {
  const [forecast, setForecast] = useState<SkuForecast | null>(null);
  const [allSkus, setAllSkus] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>(sku ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load SKU list on mount
  useEffect(() => {
    api.getInventory().then((inv) => {
      const skus = inv.inventory.map((i) => i.sku);
      setAllSkus(skus);
      if (!selected && skus.length) setSelected(skus[0]);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    api
      .forecastSku(selected, 14)
      .then(setForecast)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [selected]);

  const chartData = forecast?.forecast.map((p) => ({
    date: p.date.slice(5), // MM-DD
    Forecast: +p.point.toFixed(1),
    "80% Low": +p.lo_80.toFixed(1),
    "80% High": +p.hi_80.toFixed(1),
    "95% Low": +p.lo_95.toFixed(1),
    "95% High": +p.hi_95.toFixed(1),
  }));

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
      </div>

      {error && (
        <p className="text-sm text-red-500 py-8 text-center">{error}</p>
      )}

      {loading && (
        <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
          Loading forecast…
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
