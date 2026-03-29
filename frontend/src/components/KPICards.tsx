"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, AlertTriangle, TrendingUp, DollarSign, Upload } from "lucide-react";
import { api, type KPIs } from "@/lib/api";

interface Card {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  accent: string;
}

export default function KPICards() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getKpis()
      .then(setKpis)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="text-sm text-red-500 p-4 bg-red-50 rounded-xl border border-red-200">
        Failed to load KPIs: {error}
      </div>
    );
  }

  const cards: Card[] = kpis
    ? [
        {
          label: "Total SKUs",
          value: String(kpis.total_skus),
          sub: "active products",
          icon: <Package className="w-5 h-5" />,
          accent: "text-blue-600 bg-blue-50",
        },
        {
          label: "Reorder Alerts",
          value: String(kpis.skus_below_rop),
          sub: "below reorder point",
          icon: <AlertTriangle className="w-5 h-5" />,
          accent:
            kpis.skus_below_rop > 0
              ? "text-amber-600 bg-amber-50"
              : "text-green-600 bg-green-50",
        },
        {
          label: "Forecast Accuracy",
          value:
            kpis.avg_forecast_accuracy !== null
              ? `${kpis.avg_forecast_accuracy}%`
              : "—",
          sub: "100 − MAPE (last 30d)",
          icon: <TrendingUp className="w-5 h-5" />,
          accent: "text-purple-600 bg-purple-50",
        },
        {
          label: "Inventory Value",
          value: `$${kpis.total_inventory_value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
          sub: "on-hand × unit price",
          icon: <DollarSign className="w-5 h-5" />,
          accent: "text-emerald-600 bg-emerald-50",
        },
      ]
    : [];

  if (kpis && kpis.total_skus === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center shadow-sm">
        <Upload className="w-8 h-8 mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500 mb-2">No data yet — upload a CSV to get started</p>
        <Link
          href="/upload"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Go to Upload →
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {kpis
        ? cards.map((c) => (
            <div
              key={c.label}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-500">{c.label}</span>
                <span className={`p-2 rounded-lg ${c.accent}`}>{c.icon}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{c.value}</p>
              <p className="text-xs text-gray-400 mt-1">{c.sub}</p>
            </div>
          ))
        : Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm animate-pulse"
            >
              <div className="h-4 bg-gray-100 rounded w-24 mb-4" />
              <div className="h-7 bg-gray-100 rounded w-16 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-32" />
            </div>
          ))}
    </div>
  );
}
