/**
 * MSW request handlers — the default fixtures shared by every test.
 *
 * Each handler answers ONE endpoint the frontend talks to. Tests that need a
 * different response (404, network error, custom body) call
 * `server.use(http.get(..., () => ...))` to override per-test.
 *
 * Why default-success handlers and not default-404?
 *   The common case in a test is "the happy path works"; failure cases are
 *   specifically opted into. Defaulting to success means most tests need
 *   zero MSW setup beyond the imports — they just render and assert.
 */
import { http, HttpResponse } from 'msw';
import type { Resume } from '../../schema/resume';

const BASE = 'http://localhost:8000';

let seqId = 0;
function nextId(): string {
  seqId += 1;
  return `rs_test_${seqId}`;
}

/**
 * Build a server-shaped resume. We type the return as the structural shape
 * the API surfaces (LocalResume + timestamps) without importing RemoteResume
 * — the test fixtures don't need to round-trip through Zod, just produce
 * something `fetch().json()` returns.
 */
function seedResume(
  overrides: Partial<Resume> & { id?: string; created_at?: string; updated_at?: string } = {},
) {
  const now = new Date('2026-01-01T00:00:00Z').toISOString();
  return {
    id: 'rs_seed_1',
    title: 'Seed resume',
    sections: [] as Resume['sections'],
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export const handlers = [
  http.get(`${BASE}/api/health`, () =>
    HttpResponse.json({ status: 'ok', version: '0.2.0', env: 'test' }),
  ),

  http.get(`${BASE}/api/resumes`, () => HttpResponse.json([seedResume()])),

  http.get(`${BASE}/api/resumes/:id`, ({ params }) =>
    HttpResponse.json(seedResume({ id: String(params.id) })),
  ),

  http.post(`${BASE}/api/resumes`, async ({ request }) => {
    const body = (await request.json()) as { title: string; sections: Resume['sections'] };
    return HttpResponse.json(seedResume({ id: nextId(), ...body }), { status: 201 });
  }),

  http.put(`${BASE}/api/resumes/:id`, async ({ params, request }) => {
    const body = (await request.json()) as { title: string; sections: Resume['sections'] };
    return HttpResponse.json(seedResume({ id: String(params.id), ...body }));
  }),

  http.delete(`${BASE}/api/resumes/:id`, () => new HttpResponse(null, { status: 204 })),

  http.post(`${BASE}/api/chat`, () => {
    // Build an SSE stream with three tokens and a `done`. This matches the
    // backend's wire format (data: <json>\n\n) exactly so the streamChat()
    // parser is exercised end-to-end.
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const frames = [
          { type: 'token', value: 'Hello' },
          { type: 'token', value: ' world' },
          { type: 'done' },
        ];
        for (const frame of frames) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
        }
        controller.close();
      },
    });
    return new HttpResponse(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
    });
  }),
];
