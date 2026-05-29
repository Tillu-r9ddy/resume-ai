"""/api/chat — Server-Sent Events streaming chat.

WHY SSE instead of WebSockets?
    Chat is unidirectional once the request is sent: client posts a
    conversation, server streams back tokens. SSE is the lighter-weight
    primitive for that shape — plain HTTP, works through any HTTP/2 proxy
    that supports streaming, no upgrade handshake. WebSockets would buy us
    full duplex we don't need yet.

WHY POST and not GET?
    The browser's EventSource (the dedicated SSE client) only supports GET,
    which would force conversation history into a query string — fragile
    past a few turns. With the Fetch streaming API the client can POST a
    JSON body and read `response.body.getReader()` for the same effect,
    which is what the frontend in src/components/chat does.

WHY framing each chunk as `data: {...}\\n\\n`?
    That's the SSE wire format. Even though we use Fetch (not EventSource),
    sticking to the standard means a future EventSource-based client (or a
    proxy that understands SSE for line-buffering reasons) doesn't break.
    Each frame is a JSON object so the client can carry typed payloads
    (token / done / error) over the same channel without inventing a
    second protocol.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import Settings, get_settings
from app.services.llm import ChatMessage, ChatProvider, make_provider

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatRequestMessage(BaseModel):
    """One conversation turn. Mirrors services.llm.ChatMessage but as a
    Pydantic model so FastAPI can validate the HTTP body."""

    role: str = Field(pattern="^(user|assistant|system)$")
    content: str = Field(min_length=1, max_length=8000)


class ChatRequest(BaseModel):
    """POST body — full conversation history. Server is stateless.

    Why stateless instead of holding a session on the server?
        Two reasons. (1) The frontend already owns conversation state for
        replay/undo — keeping it in two places risks drift. (2) Stateless
        servers scale horizontally with zero coordination. The cost is a
        few extra bytes per request, which is dwarfed by the token payload.
    """

    messages: list[ChatRequestMessage] = Field(min_length=1, max_length=64)


def get_provider(
    settings: Annotated[Settings, Depends(get_settings)],
) -> ChatProvider:
    """Built fresh per request. The provider itself is stateless and cheap to
    construct (an EchoProvider is a no-op; an OpenaiProvider would be more
    expensive and the right shape would be to memoise). For now per-request
    is the simplest correct choice."""
    return make_provider(settings)


@router.post("")
async def stream_chat(
    payload: ChatRequest,
    provider: Annotated[ChatProvider, Depends(get_provider)],
) -> StreamingResponse:
    messages = [ChatMessage(role=m.role, content=m.content) for m in payload.messages]  # type: ignore[arg-type]

    async def event_stream() -> AsyncIterator[bytes]:
        try:
            async for token in provider.stream(messages):
                # Each SSE frame: `data: <json>\n\n`. JSON-encoding the token
                # itself (vs raw text) means newlines, quotes, and unicode in
                # the model's output don't break the parser.
                frame = {"type": "token", "value": token}
                yield f"data: {json.dumps(frame)}\n\n".encode()
        except Exception as exc:  # noqa: BLE001 — last-resort defence
            # Provider broke mid-stream. Send a final `error` frame so the
            # client can render a fallback instead of waiting forever.
            err = {"type": "error", "value": f"{type(exc).__name__}: {exc}"}
            yield f"data: {json.dumps(err)}\n\n".encode()
        # Explicit "done" sentinel — the frontend uses this to flip from
        # "streaming…" to "ready". Without it, the only signal is the
        # connection close, which races with the last token in the buffer.
        yield b'data: {"type":"done"}\n\n'

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            # Vital behind proxies (nginx, Cloudflare). Without these the
            # response is buffered and the client sees one giant chunk at
            # the end, defeating the whole point of streaming.
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
