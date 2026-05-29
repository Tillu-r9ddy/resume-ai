"""LLM provider abstraction.

WHY a provider interface at all instead of just calling Ollama directly?
    Three reasons:
      1. Tests. A real Ollama call is slow, non-deterministic, and depends on
         the dev machine having the model pulled. The EchoProvider lets every
         CI run exercise the streaming pipeline without that dependency.
      2. Onboarding. A new contributor can run `pip install -e ".[dev]"` and
         see the chat UI work end-to-end without first installing Ollama and
         pulling a 4 GB model. They opt in to the real provider when they
         care about real responses.
      3. Future swaps. If we later add an OpenAI/Anthropic-compatible
         provider (or vLLM, or llama.cpp), the routes don't change — only
         the factory in `get_provider` does.

WHY an async generator that yields strings instead of a callback API?
    AsyncIterator[str] is what FastAPI's StreamingResponse already consumes,
    and `async for chunk in provider.stream(...)` is the most natural shape
    for both server-side handling and tests (which `async for` to collect
    output). Callback APIs invert control and complicate cancellation —
    closing the response should stop the upstream call, and that's
    automatic with the iterator pattern.

WHY ABC rather than a Protocol or duck typing?
    Both would work. ABC gives us `isinstance(p, ChatProvider)` in tests +
    a single place a future provider author can look to see the surface
    they need to implement. Worth the small ceremony.
"""

from __future__ import annotations

import asyncio
import json
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Literal

import httpx

from app.config import Settings


@dataclass(frozen=True)
class ChatMessage:
    """One turn in a conversation. Mirrors OpenAI's familiar shape so a future
    OpenAI-compatible provider needs zero translation."""

    role: Literal["user", "assistant", "system"]
    content: str


class ChatProvider(ABC):
    """Abstract base for any source that streams chat tokens."""

    @abstractmethod
    def stream(self, messages: list[ChatMessage]) -> AsyncIterator[str]:
        """Yield response tokens (or token-sized chunks) as they arrive.

        The contract is "produce as much or as little text per yield as is
        natural for the provider." The SSE layer in routers/chat.py wraps
        each yielded chunk in a frame, so chunk shape doesn't affect the
        wire protocol.
        """
        raise NotImplementedError


class EchoProvider(ChatProvider):
    """No-LLM provider that streams back a canned response token-by-token.

    Used by default so the streaming path is exercised without external deps.
    Emits 20–40 ms inter-token delays so the frontend's typing-style render
    code has something to actually animate during development.
    """

    DELAY_S: float = 0.025

    async def stream(self, messages: list[ChatMessage]) -> AsyncIterator[str]:
        # Grab the last user message — that's the "echo target". Falling back
        # to a static string covers the empty-conversation edge case.
        last_user = next(
            (m.content for m in reversed(messages) if m.role == "user"),
            "",
        )
        intro = "Echo provider (no LLM configured). You said: "
        # Streaming a sentence one word at a time mirrors how a real LLM
        # produces tokens; word-level granularity is plenty for UI purposes
        # and keeps the test output legible without a tokenizer dependency.
        for word in (intro + last_user).split(" "):
            yield word + " "
            await asyncio.sleep(self.DELAY_S)


class OllamaProvider(ChatProvider):
    """Stream from a local Ollama instance using its native /api/chat endpoint.

    Why /api/chat (Ollama-native) and not /v1/chat/completions (OpenAI-compat)?
        Both work. The native endpoint is documented as the long-term shape;
        the OpenAI-compat one exists for drop-in clients. Since we control
        the client here, native is the simpler choice — one less translation
        layer and direct access to Ollama-only fields if we want them later.

    Why stream with httpx.AsyncClient.stream() and not a long-lived client?
        A fresh client per request keeps the lifecycle obvious — no leaked
        connections if the request is cancelled. The TCP cost is negligible
        for localhost; if we ever talk to a remote Ollama, a shared
        httpx.AsyncClient with connection pooling becomes worthwhile.
    """

    def __init__(self, *, host: str, model: str) -> None:
        self._host = host.rstrip("/")
        self._model = model

    async def stream(self, messages: list[ChatMessage]) -> AsyncIterator[str]:
        payload = {
            "model": self._model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": True,
        }
        # 60s read timeout: Ollama with a cold model can take ~30s to load
        # weights before the first token. A tighter timeout fails confusingly
        # on first use.
        timeout = httpx.Timeout(connect=5.0, read=60.0, write=10.0, pool=5.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            try:
                async with client.stream(
                    "POST", f"{self._host}/api/chat", json=payload
                ) as response:
                    response.raise_for_status()
                    # Ollama streams NDJSON — one JSON object per line. We
                    # yield each line's `message.content` so the SSE framing
                    # in the router stays the only place that knows about
                    # the wire format.
                    async for line in response.aiter_lines():
                        if not line.strip():
                            continue
                        try:
                            chunk = json.loads(line)
                        except json.JSONDecodeError:
                            # Malformed lines are skipped, not fatal. Ollama
                            # has occasionally emitted partial frames during
                            # model loads; better to render what we can than
                            # blow up the whole response.
                            continue
                        message = chunk.get("message") or {}
                        content = message.get("content", "")
                        if content:
                            yield content
                        if chunk.get("done"):
                            return
            except httpx.HTTPError as exc:
                # Surface the failure as a final assistant token rather than
                # raising; the frontend's stream consumer doesn't have a
                # mid-stream "error event" path yet, and a friendly
                # in-stream message is a better UX than a half-rendered
                # bubble that just stops.
                yield (
                    "\n\n[Ollama error: "
                    f"{type(exc).__name__}. Is `ollama serve` running and the "
                    f"model `{self._model}` pulled?]"
                )


def make_provider(settings: Settings) -> ChatProvider:
    """Factory. Routes pass `settings` so per-test overrides Just Work."""
    if settings.llm_provider == "ollama":
        return OllamaProvider(host=settings.ollama_host, model=settings.ollama_model)
    return EchoProvider()
