"""
Shared LLM client factory.

Priority:
  1. OPENROUTER_API_KEY set → use OpenRouter (base_url https://openrouter.ai/api/v1)
  2. OPENAI_API_KEY set      → use OpenAI directly

Model is read from OPENROUTER_MODEL / OPENAI_MODEL respectively.
"""
import os
from openai import OpenAI
from fastapi import HTTPException


def get_llm_client() -> tuple[OpenAI, str]:
    """Return (client, model_name) based on available environment keys."""
    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "").strip()
    if openrouter_key:
        model = os.environ.get("OPENROUTER_MODEL", "deepseek/deepseek-r2")
        client = OpenAI(
            api_key=openrouter_key,
            base_url="https://openrouter.ai/api/v1",
        )
        return client, model

    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    if openai_key:
        model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
        client = OpenAI(api_key=openai_key)
        return client, model

    raise HTTPException(500, "Не задан OPENROUTER_API_KEY или OPENAI_API_KEY")
