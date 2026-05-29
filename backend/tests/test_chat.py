"""Tests for /api/chat SSE streaming.

Why test the wire format directly?
    The browser-side reader splits on `\n\n` and JSON-parses each frame.
    Drift in framing here breaks the chat UI silently — these tests pin
    the format so a refactor must update both ends in lockstep.
"""

from __future__ import annotations

import json

from fastapi.testclient import TestClient


def _frames(body: str) -> list[dict]:
    """Parse a stream of `data: <json>\\n\\n` frames into objects.

    Tolerant of trailing whitespace and the empty-line keepalive shape so
    a future tweak to comment frames doesn't break the parse.
    """
    out: list[dict] = []
    for chunk in body.split("\n\n"):
        chunk = chunk.strip()
        if not chunk or not chunk.startswith("data:"):
            continue
        payload = chunk[len("data:") :].strip()
        out.append(json.loads(payload))
    return out


def test_chat_streams_echo_response(client: TestClient) -> None:
    response = client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "hello"}]},
    )

    assert response.status_code == 200
    # FastAPI's TestClient buffers the streamed body into `.text`. That's
    # fine for assertions — we only need the bytes, not the timing.
    frames = _frames(response.text)

    # First frame is a token, last is `done`. Anything between is also tokens.
    assert frames[-1] == {"type": "done"}
    token_frames = [f for f in frames[:-1] if f["type"] == "token"]
    assert token_frames, "expected at least one token frame"

    rendered = "".join(f["value"] for f in token_frames)
    assert "Echo provider" in rendered
    assert "hello" in rendered


def test_chat_rejects_empty_messages(client: TestClient) -> None:
    response = client.post("/api/chat", json={"messages": []})
    assert response.status_code == 422


def test_chat_rejects_bad_role(client: TestClient) -> None:
    response = client.post(
        "/api/chat",
        json={"messages": [{"role": "robot", "content": "hi"}]},
    )
    assert response.status_code == 422


def test_chat_content_type_is_event_stream(client: TestClient) -> None:
    response = client.post(
        "/api/chat",
        json={"messages": [{"role": "user", "content": "ping"}]},
    )
    assert response.headers["content-type"].startswith("text/event-stream")
