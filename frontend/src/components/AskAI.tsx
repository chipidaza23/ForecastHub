"use client";

import { useRef, useEffect, useState } from "react";
import { Sparkles, Send, Loader2, Trash2 } from "lucide-react";
import Markdown from "react-markdown";
import { api } from "@/lib/api";

const SUGGESTIONS = [
  "Which SKUs are most at risk of stockout this week?",
  "What should I reorder today and how much?",
  "How can I reduce my inventory holding costs?",
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AskAI() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = async (q?: string) => {
    const text = (q ?? question).trim();
    if (!text) return;
    setLoading(true);
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setQuestion("");
    try {
      const res = await api.ask(text);
      setMessages((prev) => [...prev, { role: "assistant", content: res.answer }]);
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
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setError(null); }}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            title="Clear conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        <span className="ml-auto text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
          AI
        </span>
      </div>

      <div className="p-5 space-y-4">
        {/* Suggestion chips — hidden after first message */}
        {messages.length === 0 && (
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
        )}

        {/* Conversation history */}
        {messages.length > 0 && (
          <div ref={scrollRef} className="space-y-3 max-h-96 overflow-y-auto">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={
                  msg.role === "user"
                    ? "text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-xl p-3"
                    : "text-sm text-gray-700 bg-purple-50 border border-purple-100 rounded-xl p-4 leading-relaxed"
                }
              >
                {msg.role === "user" ? (
                  <p className="font-medium">{msg.content}</p>
                ) : (
                  <Markdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
                      li: ({ children }) => <li className="mb-1">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      code: ({ children }) => (
                        <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">{children}</code>
                      ),
                      h3: ({ children }) => <h3 className="font-semibold mt-2 mb-1">{children}</h3>,
                      h2: ({ children }) => <h2 className="font-bold mt-3 mb-1">{children}</h2>,
                    }}
                  >
                    {msg.content}
                  </Markdown>
                )}
              </div>
            ))}
            {loading && (
              <div className="text-sm text-gray-400 bg-purple-50 border border-purple-100 rounded-xl p-4">
                Thinking…
              </div>
            )}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && submit()}
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
      </div>
    </div>
  );
}
