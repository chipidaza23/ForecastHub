"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpDown, CheckCircle, Download, RefreshCw, Search } from "lucide-react";
import { api, type InventoryItem } from "@/lib/api";

type SortableKey = "inventory_on_hand" | "reorder_point" | "safety_stock" | "eoq" | "days_of_stock" | "avg_daily_demand";

const COLUMNS: { label: string; key: SortableKey; align: string }[] = [
  { label: "On Hand", key: "inventory_on_hand", align: "text-right" },
  { label: "ROP", key: "reorder_point", align: "text-right" },
  { label: "Safety Stock", key: "safety_stock", align: "text-right" },
  { label: "EOQ", key: "eoq", align: "text-right" },
  { label: "Days Left", key: "days_of_stock", align: "text-right" },
  { label: "Avg Demand/d", key: "avg_daily_demand", align: "text-right" },
];

export default function InventoryTable() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortableKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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

  const toggleSort = (key: SortableKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filteredItems = useMemo(() => {
    let result = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((i) => i.sku.toLowerCase().includes(q));
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortKey] ?? -Infinity;
        const bVal = b[sortKey] ?? -Infinity;
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      });
    }
    return result;
  }, [items, search, sortKey, sortDir]);

  const exportCSV = () => {
    const header = "SKU,On Hand,ROP,Safety Stock,EOQ,Days Left,Avg Demand/d,Below ROP\n";
    const rows = items
      .map(
        (i) =>
          `${i.sku},${i.inventory_on_hand},${i.reorder_point},${i.safety_stock},${i.eoq},${i.days_of_stock ?? ""},${i.avg_daily_demand},${i.below_reorder_point}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory-status.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <h2 className="text-base font-semibold text-gray-900">Inventory Status</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter SKUs…"
              className="text-sm border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 w-44 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            />
          </div>
          <button
            onClick={exportCSV}
            disabled={items.length === 0}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={load}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 p-4">{error}</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wide bg-gray-50">
              <th className="px-5 py-3 text-left font-medium">SKU</th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key)}
                  className={`px-4 py-3 ${col.align} font-medium cursor-pointer select-none hover:text-gray-600 transition-colors`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    <ArrowUpDown
                      className={`w-3 h-3 ${sortKey === col.key ? "text-blue-500" : "text-gray-300"}`}
                    />
                  </span>
                </th>
              ))}
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
              : filteredItems.length === 0
                ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-sm text-gray-400">
                        {search ? "No SKUs match your filter" : "No inventory data"}
                      </td>
                    </tr>
                  )
                : filteredItems.map((item) => (
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
