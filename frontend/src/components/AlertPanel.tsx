"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ShoppingCart, Clock } from "lucide-react";
import { api, type InventoryItem } from "@/lib/api";

export default function AlertPanel() {
  const [alerts, setAlerts] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getInventory()
      .then((r) => setAlerts(r.alerts))
      .catch((e) => setError(e.message?.includes("fetch") ? "Failed to fetch — is the backend running?" : e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <h2 className="text-base font-semibold text-gray-900">Reorder Alerts</h2>
        {!loading && !error && (
          <span
            className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
              alerts.length > 0
                ? "bg-amber-100 text-amber-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {alerts.length}
          </span>
        )}
      </div>

      <div className="divide-y divide-gray-50">
        {loading &&
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="px-5 py-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-24 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-40" />
            </div>
          ))}

        {!loading && error && (
          <div className="px-5 py-4 text-sm text-red-500">{error}</div>
        )}

        {!loading && !error && alerts.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            All SKUs are above their reorder points.
          </div>
        )}

        {!loading &&
          alerts.map((item) => (
            <div key={item.sku} className="px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{item.sku}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    On hand:{" "}
                    <span className="font-medium text-amber-600">
                      {item.inventory_on_hand.toLocaleString()}
                    </span>{" "}
                    units — ROP:{" "}
                    <span className="font-medium">{item.reorder_point}</span>
                  </p>
                </div>
                <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full font-medium whitespace-nowrap">
                  Below ROP
                </span>
              </div>

              <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <ShoppingCart className="w-3 h-3" />
                  Order {item.eoq} units (EOQ)
                </span>
                {item.days_of_stock !== null && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    ~{item.days_of_stock}d of stock left
                  </span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
