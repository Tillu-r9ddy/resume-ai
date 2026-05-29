/**
 * client.test.ts — exercise the HTTP wrapper through the MSW network layer.
 *
 * These aren't unit tests in the Jest-mock sense — they're integration tests
 * for the network boundary. The MSW handlers stand in for FastAPI; the test
 * actually fetches, parses JSON, builds ApiError, and yields SSE events. If
 * the wire format drifts on either side, one of these breaks.
 */
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { ApiError, resumesApi, streamChat } from './client';
import { server } from '../test/msw/server';

const BASE = 'http://localhost:8000';

describe('resumesApi', () => {
  it('list returns the seeded resume from MSW', async () => {
    const list = await resumesApi.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe('Seed resume');
  });

  it('create returns the server-assigned id', async () => {
    const created = await resumesApi.create({ title: 'New', sections: [] });
    expect(created.title).toBe('New');
    expect(created.id).toMatch(/^rs_test_/);
  });

  it('delete resolves to undefined on 204', async () => {
    await expect(resumesApi.delete('rs_seed_1')).resolves.toBeUndefined();
  });

  it('wraps non-2xx in ApiError with the status code', async () => {
    server.use(
      http.get(`${BASE}/api/resumes/missing`, () =>
        HttpResponse.json({ detail: 'not found' }, { status: 404 }),
      ),
    );

    await expect(resumesApi.get('missing')).rejects.toMatchObject({
      status: 404,
      message: 'not found',
    });
  });

  it('ApiError exposes the parsed body', async () => {
    server.use(
      http.get(`${BASE}/api/resumes/boom`, () =>
        HttpResponse.json({ detail: 'kaboom', extra: 1 }, { status: 500 }),
      ),
    );

    try {
      await resumesApi.get('boom');
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).body).toEqual({ detail: 'kaboom', extra: 1 });
    }
  });
});

describe('streamChat', () => {
  it('yields tokens and a done event from the SSE stream', async () => {
    const events: unknown[] = [];
    for await (const event of streamChat([{ role: 'user', content: 'hi' }])) {
      events.push(event);
    }
    expect(events).toEqual([
      { type: 'token', value: 'Hello' },
      { type: 'token', value: ' world' },
      { type: 'done' },
    ]);
  });

  it('throws an ApiError when the chat endpoint fails', async () => {
    server.use(http.post(`${BASE}/api/chat`, () => new HttpResponse(null, { status: 503 })));

    const iter = streamChat([{ role: 'user', content: 'hi' }]);
    await expect(iter.next()).rejects.toBeInstanceOf(ApiError);
  });
});
