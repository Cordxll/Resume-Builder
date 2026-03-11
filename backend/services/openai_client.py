"""Shared OpenAI-compatible client factory.

Supports OpenAI, Google Gemini, DeepSeek, Groq, and any provider
that exposes an OpenAI-compatible chat completions endpoint.

Configure via environment variables:
    OPENAI_API_KEY   - API key (required)
    OPENAI_BASE_URL  - Custom base URL (optional, defaults to OpenAI)
    OPENAI_MODEL     - Model name (optional, defaults to gemini-2.5-flash)
"""
import os
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


def get_openai_client(api_key: Optional[str] = None):
    """Get or create an AsyncOpenAI client, optionally pointed at a custom base URL."""
    try:
        from openai import AsyncOpenAI
        key = api_key or os.getenv('OPENAI_API_KEY', '')
        if key:
            base_url = os.getenv('OPENAI_BASE_URL')
            kwargs = {"api_key": key}
            if base_url:
                kwargs["base_url"] = base_url
            return AsyncOpenAI(**kwargs)
    except Exception as e:
        print(f"Failed to initialize OpenAI client: {e}")
    return None


def get_model() -> str:
    """Get the configured model name."""
    return os.getenv('OPENAI_MODEL', 'gemini-2.5-flash')
