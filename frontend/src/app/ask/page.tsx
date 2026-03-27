import AskAI from "@/components/AskAI";

export default function AskPage() {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-gray-900">AI Advisor</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Ask natural language questions about your inventory and forecasts
        </p>
      </div>
      <AskAI />
    </div>
  );
}
