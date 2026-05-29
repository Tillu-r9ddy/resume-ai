# Phase 6c — Streaming Chat via SSE + Pluggable LLM Provider

> Goal: add `/api/chat` that streams tokens back to the browser as they're generated, with a provider abstraction that lets the default `EchoProvider` run with zero install and `OllamaProvider` ride the same code path for the real LLM.

## What we built and WHY

### 1. `app/services/llm.py` — `ChatProvider` ABC + two implementations

```python
class ChatProvider(ABC):
    @abstractmethod
    async def stream(self, messages: list[ChatMessage]) -> AsyncIterator[str]: ...
```

**Why an ABC, not a Protocol?** Both work for structural typing, but the ABC gets us a runtime contract — `TypeError` at instantiation if a subclass forgets a method. For a provider that's bound at app startup (not per-request), failing loud at boot is much better than NoneType errors mid-stream.

**Why `AsyncIterator[str]` instead of an async callback?** Iterators give the consumer back-pressure for free — when the consumer is slow, the producer naturally throttles via `await`. Callbacks invert control and make cancellation messy (the producer has to track aborted state and stop emitting). The router's SSE serializer just `async for` s the iterator and yields wire frames; the provider doesn't know SSE exists.

**EchoProvider** splits the last user message on spaces and yields each token with a 25 ms `asyncio.sleep`. Cheap, zero dependencies, makes the streaming pipeline observable without an LLM in the loop. The default for every dev workflow that doesn't explicitly opt into Ollama.

**OllamaProvider** POSTs to `/api/chat` with `stream=True`, then parses NDJSON line-by-line from `httpx.AsyncClient.aiter_lines()`. Tokens come out of Ollama as `{"message": {"content": "..."}}` per line; the provider yields just the content string. The frame format is Ollama's, not ours — translation lives in this one class and the router stays format-agnostic.

**`make_provider(settings)`** is a switch on `settings.llm_provider`. One place to add new providers; nothing else in the codebase knows the list of options.

### 2. `app/routers/chat.py` — SSE endpoint

The wire format is the standard SSE convention: `data: <json>\n\n` per frame, JSON discriminated on `type`.

```
data: {"type":"token","value":"Hello"}\n\n
data: {"type":"token","value":" world"}\n\n
data: {"type":"done"}\n\n
```

Three intentional choices:

- **POST, not GET.** EventSource only supports GET — that locks you out of POST bodies, and a chat conversation is genuinely a body (KB of message history, not a query string). The frontend uses `fetch + getReader` instead of `EventSource`, which costs us auto-reconnect but buys us POST + custom headers. Worth the trade.
- **`X-Accel-Buffering: no` + `Cache-Control: no-cache, no-transform`.** nginx (and several other reverse proxies) buffer responses by default — your tokens would arrive in one chunk at the end. These headers tell every middlebox to forward bytes as they arrive. Without them, the stream "works" locally and feels broken in prod.
- **Errors as in-stream frames, not 500s.** If the LLM raises mid-generation, we emit `{"type":"error","value":"..."}` then `done` — instead of dropping the connection. The browser already got `200 OK` headers; switching to 500 mid-stream isn't possible at the HTTP layer anyway. Keeping the error inside the framed protocol means the frontend's iterator never throws for a server-side LLM failure — it sees the structured error and can render a UI message.

### 3. Tests — `tests/test_chat.py` (4 tests)

The hard part of testing SSE is **frame boundaries** — the response is a byte stream, not a list. Helper:

```python
def _frames(response_body: bytes) -> list[dict]:
    text = response_body.decode("utf-8")
    raw_frames = [f for f in text.split("\n\n") if f.strip()]
    return [json.loads(f.removeprefix("data: ")) for f in raw_frames]
```

Tests:

- **`test_chat_streams_echo_response`** — full happy path. Asserts at least one token frame, a final done frame, and that the joined token values equal the input message. End-to-end coverage of the provider → router → wire-format pipeline.
- **`test_chat_rejects_empty_messages`** — Pydantic validation regression. An empty `messages: []` is a 422 before the provider is ever called.
- **`test_chat_rejects_bad_role`** — role enum enforcement. `{"role": "robot"}` should 422.
- **`test_chat_content_type_is_event_stream`** — header regression. If a refactor accidentally drops `text/event-stream`, EventSource-style consumers (and nginx's buffering behaviour) will silently break. Worth a dedicated test.

### 4. `config.py` additions

Three new env vars, all defaulting to safe values:

| Var                      | Default                  | Purpose                                            |
| ------------------------ | ------------------------ | -------------------------------------------------- |
| `RESUME_AI_LLM_PROVIDER` | `echo`                   | `"echo"` or `"ollama"`. Echo = zero install.       |
| `RESUME_AI_OLLAMA_HOST`  | `http://localhost:11434` | Ollama API base URL (only used if provider=ollama) |
| `RESUME_AI_OLLAMA_MODEL` | `llama3.1:8b`            | Model tag (must already be `ollama pull`-ed)       |

Why default to echo? **Onboarding curve.** A fresh clone should `pip install && pytest && uvicorn` to a working chat panel in under 30 seconds. Requiring a 4 GB model download before any of that runs would lose contributors. The real LLM is opt-in for the people who want it.

## Acceptance criteria

- ✅ `POST /api/chat` with `{"messages":[{"role":"user","content":"hi"}]}` streams `data: ...` frames.
- ✅ Final frame is `{"type":"done"}`.
- ✅ Tokens arrive incrementally (not in one chunk) when proxied behind nginx with the `X-Accel-Buffering: no` header set.
- ✅ Setting `RESUME_AI_LLM_PROVIDER=ollama` swaps providers with no code change.
- ✅ Empty `messages` array → 422.
- ✅ All 4 chat tests pass; ruff clean.

## What we deliberately did NOT do

- **EventSource on the client.** No POST → no chat history → not useful. Standard `fetch + getReader` is the right tool here, even though it costs us auto-reconnect.
- **Per-turn rate limiting.** Single-user dev tool; no abuse vector worth budgeting for yet. Add when there's a real edge.
- **Conversation persistence.** The chat history is route-local on the frontend (`useState`). Persisting would invite an undo-of-undo design question that's not worth tackling now.
- **Tool calling / RAG.** Real value, but separately scoped — Phase 6e+. Today's chat is "stream a reply to a prompt".
- **Token-by-token metrics.** No observability platform to ship them to yet.

## Interview questions Phase 6c prepares you to answer

> **Q:** Why SSE over WebSockets for a chat stream?
> **A:** SSE is one-way (server → client), text-based, runs over plain HTTP, and reconnects automatically with EventSource. For server-to-client token streaming that's a perfect fit. WebSockets get you bidirectional + binary frames, neither of which a token stream needs. WebSockets also cost you more infra config — many proxies require special upgrade handling. SSE just works through HTTP/1.1 + HTTP/2.

> **Q:** Why `fetch + getReader` instead of `EventSource` on the client?
> **A:** EventSource only supports GET. A chat conversation is a POST body — many KB of message history. `fetch + response.body.pipeThrough(new TextDecoderStream())` gives us POST streaming with everything EventSource provides except auto-reconnect (which we don't need for an LLM stream that won't be reused).

> **Q:** What does `X-Accel-Buffering: no` actually do?
> **A:** It's the nginx-specific header that disables response buffering for that one response. Without it, nginx waits to flush bytes until either the buffer fills or the upstream closes — so your tokens look like they arrive all at once at the end. Other proxies have their own variant; the `Cache-Control: no-cache, no-transform` belt-and-braces covers most of them.

> **Q:** Why an ABC for `ChatProvider` and not a `Protocol`?
> **A:** Runtime contract. Forgetting to implement `stream()` is a `TypeError` at instantiation — at app boot, not at request time. Protocols are structural; the violation only shows up where you try to call the missing method. For a provider that's bound once at startup and used everywhere, ABC's eager check is the right trade.

> **Q:** Why default to an echo provider?
> **A:** Onboarding cost. A real LLM is a 4 GB download + a heavy local process. Defaulting to echo means a fresh clone of the repo runs the streaming pipeline end-to-end with zero install. The wire format and the front-end consumer are exercised in tests every CI run, regardless of whether the real provider is reachable. Real LLM is opt-in via one env var.

## What's next: Phase 6d — wire the frontend

- Thin `api/client.ts` wrapper (no axios, no RTK Query — see that doc for why).
- `useBackendAutosave` hook replaces the perceptual "saving / saved" cue with real network state.
- `streamChat()` async generator consumes the SSE stream from `/api/chat`.
- Rewritten `Chat.tsx` with `AbortController`-bound Stop button.
