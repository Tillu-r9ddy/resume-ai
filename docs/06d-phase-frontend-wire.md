# Phase 6d — Wire the Frontend to the Backend

> Goal: replace the frontend's localStorage-only autosave with real backend calls, and turn the placeholder Chat route into a working streaming UI. The constraint: don't disturb the existing Redux + redux-undo + redux-persist wiring that took Phase 4 to get right.

## What we built and WHY

### 1. `src/api/client.ts` — hand-rolled fetch wrapper

```ts
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  (import.meta.env.DEV ? 'http://localhost:8000' : '');

export async function* streamChat(messages, init?): AsyncGenerator<ChatStreamEvent> { … }
export const resumesApi = { list, get, create, update, delete };
```

Why not axios / RTK Query / TanStack Query?

- **axios** is 13 KB gz of HTTP wrapper for ~50 lines of fetch usage. Doesn't earn its weight.
- **RTK Query** would duplicate the resume document into a cache that fights the existing Redux slice (already wrapped in redux-undo and redux-persist). Either we'd write the cache into the slice (back to square one) or we'd rewire the store. The four endpoints we hit don't justify the rework.
- **TanStack Query** has the same problem — its cache and our store overlap. It shines when the server is the source of truth; for us the editing slice is and the server's a mirror.
- Hand-rolled fetch is ~50 lines, types are exact, and the two affordances we actually need (typed error class, base URL resolution) live in one file.

`ApiError` is a custom Error subclass with `status` and `body` fields, so callers can branch on `err.status === 404` without parsing the message. The 404 detection in the autosave hook (below) depends on this.

**SSE consumption via `pipeThrough(new TextDecoderStream())`** instead of manually decoding. Without it you have to handle multi-byte UTF-8 chars straddling a chunk boundary — a real bug that only shows up with non-ASCII tokens. Letting the platform handle UTF-8 means our code only deals with the SSE framing (`\n\n` between frames, `data:` line prefix).

### 2. `src/hooks/useBackendAutosave.ts` — debounced save with abort-on-supersede

```ts
useEffect(() => {
  if (isFirstRenderRef.current) {
    isFirstRenderRef.current = false;
    return;
  }
  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(runSave, debounceMs);
  return () => clearTimeout(timerRef.current);
}, [resume]);
```

Why a hook and not Redux middleware?

- **Middleware fires for every action**, including undo/redo and redux-persist's REHYDRATE. Filtering those out is fragile.
- A hook subscribes to the **resolved** document — React's render cycle naturally coalesces bursts.
- `AbortController` plugs in naturally — when a newer change arrives, abort the in-flight PUT before starting a new one. Middleware shape has no obvious hook for that.

Save lifecycle:

1. User edits → resume slice updates → selector fires.
2. Pending timer cancelled, new one started (`debounceMs` default 800).
3. Timer fires: POST if no cached remote id (first save), PUT otherwise. Server-assigned id is cached in `localStorage:resume-ai:remote-id`.
4. Status transitions: `idle → saving → saved`. On failure: `offline` — the next edit retries automatically. No queue, no journal — the current document IS the state to send.

Three corner cases handled explicitly:

- **First render is rehydration, not a user edit.** `isFirstRenderRef` skips it — otherwise reloading the page would trigger a no-op save against the server.
- **404 invalidates the cached id.** If the server-side record was deleted (manual cleanup, dev reset), the next save would loop forever on PUT-then-404. The hook drops the cached id on 404 so the next save POSTs fresh.
- **AbortController on supersede.** A 2 KB document at the edge of the debounce window can have two PUTs racing. We abort the in-flight one — if it had reached the server, the server processed it; if not, the new one with strictly newer content is on its way.

### 3. `src/components/editor/AutosaveIndicator.tsx` — pulls from the hook

Four states, each with a distinct visual:

| State     | Pill        | Dot                     |
| --------- | ----------- | ----------------------- |
| `idle`    | (hidden)    | —                       |
| `saving`  | accent-soft | pulsing accent          |
| `saved`   | surface-2   | emerald, with timestamp |
| `offline` | amber/15    | solid amber             |

Why hide on `idle` (first paint, before any edit)? Calmer load. The pill appearing means "I just did something" — showing "Saved" on a fresh page load is a lie.

Why no retry button on `offline`? The autosave hook already covers it — the next edit retries. A retry button would either duplicate that logic or appear when there's nothing to retry.

### 4. `src/routes/Chat.tsx` — real streaming UI

```tsx
const [turns, setTurns] = useState<ChatTurn[]>([]);
const send = useCallback(async () => {
  const userTurn = { id: uuid(), role: 'user', content: trimmed };
  const draftTurn = { id: uuid(), role: 'assistant', content: '', streaming: true };
  setTurns((prev) => [...prev, userTurn, draftTurn]);
  for await (const event of streamChat([...turnsAsMessages, userTurn], { signal })) {
    if (event.type === 'token')
      setTurns((prev) =>
        prev.map((t) => (t.id === draftId ? { ...t, content: t.content + event.value } : t)),
      );
    else if (event.type === 'done') break;
  }
}, [input, isStreaming, turns]);
```

Three subtle decisions:

- **Local state, not Redux.** Chat is route-local — nothing else reads it, and we explicitly don't want it inside the undo history. useState keeps the wiring minimal.
- **Build the conversation snapshot with the user turn appended.** `setTurns(...)` is async; inside the same `send()` closure, `turns` is the value from before the user message was added. Building the conversation manually means the request reflects what the user just typed.
- **AbortController bound to a Stop button.** Long generations can be cancelled. The catch block treats `AbortError` as a no-op (it's not a failure — the user did it on purpose) and only surfaces other errors.

⌘/Ctrl+Enter to send is the standard chat affordance — plain Enter inserts a newline so multi-line prompts work. Scroll-to-bottom on every `turns` change gives the typing-style feel without IntersectionObserver gymnastics.

## Acceptance criteria

- ✅ Editing a field in the Editor triggers a POST (first edit) or PUT (subsequent) within `debounceMs`.
- ✅ The AutosaveIndicator shows saving → saved with a real timestamp.
- ✅ Killing the backend mid-edit puts the indicator in `offline`; next edit retries.
- ✅ Refreshing the page reuses the same remote id (no duplicate created).
- ✅ Deleting the record server-side and editing again creates a fresh one (404 → drop cached id).
- ✅ `/chat` streams tokens word-by-word from the echo provider; Stop aborts mid-stream cleanly.
- ✅ `npm run typecheck && npm run lint` both pass.

## What we deliberately did NOT do

- **RTK Query / TanStack Query.** Covered above — the existing Redux + redux-persist + redux-undo wiring is already complex; doubling up the cache would create more bugs than features.
- **Optimistic updates.** Last-write-wins on a single-user document is fine. Optimistic updates pay off when latency is visible and conflicts are real.
- **Conflict resolution.** Same reason. If multi-user lands, we'll need it; until then, every conflict scenario requires two browser tabs to invent.
- **Offline queue.** The current doc IS the queue. A failed save just means "send it again next debounce". A persisted queue would be a different concurrency model — last-write-wins still works in flaky-network conditions because every save is full-replace.
- **`Sec-Fetch-Mode` / custom headers.** Not needed for the same-origin path through nginx; CORS only kicks in for the localhost:8000 dev origin and the existing `allow_origins` covers it.

## Interview questions Phase 6d prepares you to answer

> **Q:** Why not RTK Query for the resume CRUD?
> **A:** The resume document already lives in a Redux slice that's wrapped by redux-undo and redux-persist. RTK Query would put the same data into a separate cache, and the two would need to be kept in sync — either by writing the cache into the slice (defeating the point) or by rewriting the slice to not exist. For four endpoints, ~50 lines of plain fetch + a typed error class is the right amount of abstraction. RTK Query shines when the server is the source of truth and the client is a thin presenter; we're the opposite.

> **Q:** What does `AbortController` give you for autosave?
> **A:** Cancellation of stale work. When the user types fast, a debounced save might fire and start a PUT before the user's _next_ edit triggers another save. Without abort, the second save and the first race — and if the second arrives first, the server briefly persists older content. Aborting the first request before starting the second guarantees the last-issued PUT is the last-applied PUT.

> **Q:** Why an async generator (`AsyncGenerator<ChatStreamEvent>`) instead of an onToken callback?
> **A:** Back-pressure for free. The consumer pulls events on `for await ... of`, so a slow consumer naturally throttles the reader. Callbacks invert control — the producer pushes whether or not the consumer can keep up, and you have to invent your own queue / batch logic. Generators also compose with `AbortController` cleanly (the iterator's `finally` block releases the reader).

> **Q:** How do you handle UTF-8 boundaries in the SSE reader?
> **A:** `response.body.pipeThrough(new TextDecoderStream())`. Without it, a multi-byte char (✅, an emoji, anything non-ASCII) can straddle a chunk boundary and you'd get half a character. TextDecoderStream is built into the platform and buffers across chunks correctly. Lets our code only worry about the SSE framing (`\n\n` between frames, `data:` line prefix).

> **Q:** Why does the autosave hook skip the first render?
> **A:** That render is redux-persist's REHYDRATE settling — restoring the saved document from localStorage. Saving on that render would mean every page load fires a no-op PUT. The `isFirstRenderRef` guard distinguishes "the state just loaded" from "the user edited something".

## What's next: Phase 7 — PDF export + concurrent React polish

- Dedicated `/print` route that auto-fires `window.print()` (browser native "Save as PDF").
- `useDeferredValue` on the Preview so typing stays smooth on large resumes.
- Print stylesheet via `@media print` + `@page` for paper sizing.
