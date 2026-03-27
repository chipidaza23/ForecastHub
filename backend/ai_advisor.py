"""
ai_advisor.py — Natural language inventory queries powered by Groq.
"""

from __future__ import annotations

import json
import os

from groq import Groq

# Optional Langfuse observability — gracefully disabled if not configured
_langfuse = None
try:
    from langfuse import Langfuse
    _langfuse = Langfuse()
    _langfuse.auth_check()
except Exception:
    _langfuse = None

SYSTEM_PROMPT = """You are an expert inventory and supply chain analyst embedded in ForecastHub,
a demand forecasting dashboard. You have deep knowledge of:

- Inventory management (safety stock, reorder points, EOQ, ABC analysis)
- Demand forecasting (ARIMA, seasonal models, MAPE, bias)
- Supply chain optimisation (lead times, service levels, holding costs)
- Retail and e-commerce operations

When answering questions:
1. Be concise but precise — bullet points are preferred over long paragraphs.
2. Always ground your answer in the inventory data provided in the context.
3. Highlight any SKUs that are at risk (below reorder point, low days of stock, high forecast error).
4. Suggest specific, actionable recommendations with numbers where possible.
5. If the question is outside the scope of inventory/forecasting, politely redirect.

You will receive a JSON context block containing current inventory status and
recent forecast data. Use it to give data-driven answers.
"""


def ask(
    question: str,
    inventory_context: list[dict],
    forecast_context: list[dict] | None = None,
) -> dict:
    """
    Send a natural language question to Groq with inventory context.

    Args:
        question: User's free-text question.
        inventory_context: List of inventory status dicts from inventory_logic.
        forecast_context: Optional list of forecast summary dicts.

    Returns:
        {"answer": str, "model": str, "tokens_used": int}
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise EnvironmentError("GROQ_API_KEY is not set. Add it to your .env file.")

    client = Groq(api_key=api_key)

    context_payload = {
        "inventory_status": inventory_context,
    }
    if forecast_context:
        context_payload["forecast_summaries"] = forecast_context

    user_message = f"""<inventory_context>
{json.dumps(context_payload, indent=2)}
</inventory_context>

Question: {question}"""

    # Start Langfuse trace if available
    trace = None
    generation = None
    if _langfuse:
        trace = _langfuse.trace(name="ai-advisor-ask", input=question)
        generation = trace.generation(
            name="groq-completion",
            model="llama-3.3-70b-versatile",
            input=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
        )

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        max_tokens=1024,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
    )

    choice = response.choices[0]
    answer = choice.message.content or ""
    tokens = (response.usage.prompt_tokens + response.usage.completion_tokens) if response.usage else 0

    # End Langfuse trace
    if generation:
        generation.end(output=answer, usage={"total_tokens": tokens})
    if trace:
        trace.update(output=answer)

    return {
        "answer": answer,
        "model": response.model,
        "tokens_used": tokens,
    }
