"use client";

import { useState } from "react";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

const SUGGESTIONS = [
  "Which SKUs are most at risk of stockout this week?",
  "What should I reorder today and how much?",
  "How can I reduce my inventory holding costs?",
];

export default function AskAI() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (q?: string) => {
    const text = (q ?? question).trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await api.ask(text);
      setAnswer(res.answer);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      // Provide specific, actionable error messages
      if (msg.includes("GROQ_API_KEY")) {
        setError("AI Advisor requires a GROQ_API_KEY. Set it in your backend .env file.");
      } else if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setError("Cannot connect to backend. Make sure the API server is running.");
      } else if (msg.includes("503")) {
        setError("AI service unavailable. Check that GROQ_API_KEY is configured on the server.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        <Sparkles className="w-4 h-4 text-purple-500" />
        <h2 className="text-base font-semibold text-gray-900">Ask AI Advisor</h2>
        <span className="ml-auto text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
          AI
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => { setQuestion(s); submit(s); }}
              className="text-xs bg-gray-50 hover:bg-purple-50 hover:text-purple-700 text-gray-600 px-3 py-1.5 rounded-full border border-gray-200 hover:border-purple-200 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Ask anything about your inventory…"
            className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder-gray-400"
          />
          <button
            onClick={() => submit()}
            disabled={loading || !question.trim()}
            className="p-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl transition-colors"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
            {error}
          </div>
        )}

        {/* Answer */}
        {answer && (
          <div className="text-sm text-gray-700 bg-purple-50 border border-purple-100 rounded-xl p-4 leading-relaxed whitespace-pre-wrap">
            {answer}
          </div>
        )}
      </div>
    </div>
  );
}
