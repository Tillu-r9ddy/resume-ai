/**
 * Chat — placeholder for the AI assistant route ("/chat").
 *
 * The real chat lands in Phase 6: SSE streaming from a FastAPI + Ollama backend,
 * tool calling, RAG over the resume document. Phase 2 just owns the route slot.
 */
export default function Chat(): React.JSX.Element {
  return (
    <article className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">AI chat</h1>
      <p className="mt-2 text-ink-muted">
        Phase 2 stub. In Phase 6 this becomes a streaming chat panel wired to a local Ollama backend
        over Server-Sent Events.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-surface p-6 text-sm text-ink-muted">
        <p>
          For now, imagine a chat panel here. The route exists so we can prove out lazy loading:
          open DevTools → Network → click this nav link and watch a brand-new{' '}
          <code className="rounded bg-surface-2 px-1">Chat-*.js</code> chunk download on demand.
        </p>
      </div>
    </article>
  );
}
