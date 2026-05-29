/**
 * Chat — Phase 6d: the real streaming chat UI.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Architecture
 * ─────────────────────────────────────────────────────────────────────────────
 *   • Local state owns the conversation (useState). The backend is
 *     stateless — we send the whole conversation on each turn. That makes
 *     replay/undo trivial (just slice the array) without a server roundtrip.
 *
 *   • streamChat() yields ChatStreamEvent values. We consume the iterator
 *     in a useEffect-like async function, appending tokens to a "drafting"
 *     assistant message that exists in state for the duration of the stream.
 *     When the `done` event arrives, we mark the stream as finished; the
 *     drafting message becomes a normal turn.
 *
 *   • AbortController binds to the "Stop" button so a long generation can
 *     be cancelled mid-stream without leaking the underlying fetch.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why not Redux for chat state?
 * ─────────────────────────────────────────────────────────────────────────────
 *   Chat history is route-local — nothing outside this component reads it,
 *   and we don't want it inside the undo history that wraps the resume.
 *   useState keeps the wiring minimal and avoids dragging the chat into
 *   undo/redo by accident.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { streamChat, type ChatMessage } from '../api/client';

interface ChatTurn extends ChatMessage {
  id: string;
  /** True while this message is mid-stream from the server. */
  streaming?: boolean;
}

export default function Chat(): React.JSX.Element {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Scroll the transcript to the bottom on every new token. `scrollTop =
  // scrollHeight` is the standard "snap to latest" affordance — gives the
  // typing-style feel without needing IntersectionObserver gymnastics.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userTurn: ChatTurn = { id: crypto.randomUUID(), role: 'user', content: trimmed };
    const draftId = crypto.randomUUID();
    const draftTurn: ChatTurn = {
      id: draftId,
      role: 'assistant',
      content: '',
      streaming: true,
    };

    setTurns((prev) => [...prev, userTurn, draftTurn]);
    setInput('');
    setError(null);
    setIsStreaming(true);

    // Build the conversation snapshot the server should see. We include the
    // user turn we just added because `turns` is async-updated by setState
    // and won't reflect the new entry inside this closure.
    const conversation: ChatMessage[] = [
      ...turns.map(({ role, content }) => ({ role, content })),
      { role: userTurn.role, content: userTurn.content },
    ];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const event of streamChat(conversation, { signal: controller.signal })) {
        if (event.type === 'token') {
          setTurns((prev) =>
            prev.map((t) => (t.id === draftId ? { ...t, content: t.content + event.value } : t)),
          );
        } else if (event.type === 'error') {
          setError(event.value);
          break;
        } else if (event.type === 'done') {
          break;
        }
      }
    } catch (err) {
      // AbortError isn't a real failure — the user pressed Stop.
      if (err instanceof DOMException && err.name === 'AbortError') {
        // no-op
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setIsStreaming(false);
      setTurns((prev) => prev.map((t) => (t.id === draftId ? { ...t, streaming: false } : t)));
      abortRef.current = null;
    }
  }, [input, isStreaming, turns]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">AI chat</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Streams from the FastAPI backend (default: echo provider; set{' '}
          <code className="rounded bg-surface-2 px-1">RESUME_AI_LLM_PROVIDER=ollama</code> to talk
          to a local Llama 3.1).
        </p>
      </header>

      <div
        ref={scrollRef}
        className="flex h-[28rem] flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-surface p-4"
      >
        {turns.length === 0 && (
          <p className="text-sm text-ink-muted">Say hi to see the streaming pipeline in action.</p>
        )}
        {turns.map((turn) => (
          <ChatBubble key={turn.id} turn={turn} />
        ))}
        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {error}
          </div>
        )}
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // ⌘/Ctrl + Enter to send — the standard chat-affordance pair
            // (plain Enter inserts a newline so multi-line prompts work).
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send();
            }
          }}
          rows={3}
          placeholder="Ask the assistant…  (⌘/Ctrl + Enter to send)"
          className="flex-1 resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-accent"
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={stop}
            className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-200 hover:bg-amber-500/20"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-canvas disabled:opacity-40"
          >
            Send
          </button>
        )}
      </form>
    </article>
  );
}

function ChatBubble({ turn }: { turn: ChatTurn }): React.JSX.Element {
  const isUser = turn.role === 'user';
  return (
    <div
      className={[
        'max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
        isUser ? 'self-end bg-accent-soft text-ink' : 'self-start bg-surface-2 text-ink',
      ].join(' ')}
    >
      {turn.content}
      {turn.streaming && (
        <span aria-hidden="true" className="ml-1 inline-block animate-pulse">
          ▍
        </span>
      )}
    </div>
  );
}
