"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { api, type InventoryItem } from "@/lib/api";

export default function InventoryTable() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .getInventory()
      .then((r) => setItems(r.inventory))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Inventory Status</h2>
        <button
          onClick={load}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-500 p-4">{error}</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wide bg-gray-50">
              <th className="px-5 py-3 text-left font-medium">SKU</th>
              <th className="px-4 py-3 text-right font-medium">On Hand</th>
              <th className="px-4 py-3 text-right font-medium">ROP</th>
              <th className="px-4 py-3 text-right font-medium">Safety Stock</th>
              <th className="px-4 py-3 text-right font-medium">EOQ</th>
              <th className="px-4 py-3 text-right font-medium">Days Left</th>
              <th className="px-4 py-3 text-right font-medium">Avg Demand/d</th>
              <th className="px-4 py-3 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              : items.map((item) => (
                  <tr key={item.sku} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-900">{item.sku}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {item.inventory_on_hand.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{item.reorder_point}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{item.safety_stock}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{item.eoq}</td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        item.days_of_stock !== null && item.days_of_stock < 14
                          ? "text-amber-600"
                          : "text-gray-700"
                      }`}
                    >
                      {item.days_of_stock !== null ? `${item.days_of_stock}d` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {item.avg_daily_demand}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {item.below_reorder_point ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
                          <AlertTriangle className="w-3 h-3" />
                          Reorder
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          OK
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
