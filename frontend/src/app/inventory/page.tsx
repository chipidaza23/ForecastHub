import InventoryTable from "@/components/InventoryTable";

export default function InventoryPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Inventory</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Full inventory status with safety stock, reorder points, and EOQ
        </p>
      </div>
      <InventoryTable />
    </div>
  );
}
