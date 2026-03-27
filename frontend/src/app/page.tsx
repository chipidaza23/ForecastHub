import Link from "next/link";
import KPICards from "@/components/KPICards";
import ForecastChart from "@/components/ForecastChart";
import InventoryTable from "@/components/InventoryTable";
import AlertPanel from "@/components/AlertPanel";
import AskAI from "@/components/AskAI";

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Real-time demand forecasts and inventory health
          </p>
        </div>
        <Link
          href="/upload"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors"
        >
          Upload Data
        </Link>
      </div>

      {/* KPI row */}
      <KPICards />

      {/* Forecast + Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <ForecastChart />
        </div>
        <AlertPanel />
      </div>

      {/* Inventory table */}
      <InventoryTable />

      {/* AI Advisor */}
      <AskAI />
    </div>
  );
}
