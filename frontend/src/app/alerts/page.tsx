import AlertPanel from "@/components/AlertPanel";

export default function AlertsPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Reorder Alerts</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          SKUs below their reorder point that need restocking
        </p>
      </div>
      <AlertPanel />
    </div>
  );
}
