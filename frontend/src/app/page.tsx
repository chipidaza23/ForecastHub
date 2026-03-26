import KPICards from "@/components/KPICards";
import ForecastChart from "@/components/ForecastChart";
import InventoryTable from "@/components/InventoryTable";
import AlertPanel from "@/components/AlertPanel";
import AskAI from "@/components/AskAI";

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Real-time demand forecasts and inventory health
        </p>
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
