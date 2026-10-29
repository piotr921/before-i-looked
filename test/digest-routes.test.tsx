import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestNight } from '../src/digest/types.js';

// Fixtures live in a temp dir; runs/ is read-only and never touched here.
let runsDir: string;

const config = () => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

const GOOD_NIGHT = [
  '{"at":"2026-11-01T01:00:00+01:00","job":"rig/rotate-logs","status":"ok","owner":"rook"}',
  '{"at":"2026-11-01T02:00:00+01:00","job":"a/job","status":"retry","owner":null,"error":"timeout"}',
  '{"at":"2026-11-01T02:05:00+01:00","job":"a/job","status":"ok","owner":"rook"}',
  '{"at":"2026-11-01T03:00:00+01:00","job":"digest/render","status":"fail","owner":"rook","error":"quota exceeded"}',
];

const BAD_LINE_NIGHT = [
  '{"at":"2026-11-03T01:00:00+01:00","job":"b/job","status":"ok","owner":"rook"}',
  'this is not json',
  '{"at":"2026-11-03T02:00:00+01:00","job":"a/job","status":"ok","owner":"rook"}',
];

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  writeFileSync(join(runsDir, '2026-11-01.jsonl'), GOOD_NIGHT.join('\n') + '\n');
  writeFileSync(join(runsDir, '2026-11-02.jsonl'), '');
  writeFileSync(join(runsDir, '2026-11-03.jsonl'), BAD_LINE_NIGHT.join('\n') + '\n');
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('GET /digest/:night (page)', () => {
  it('renders every job of the night', async () => {
    const res = await createApp(config()).request('/digest/2026-11-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    for (const job of ['a/job', 'digest/render', 'rig/rotate-logs']) {
      expect(html).toContain(job);
    }
  });

  it('answers 404 for a night with no file', async () => {
    const res = await createApp(config()).request('/digest/2026-01-01');
    expect(res.status).toBe(404);
  });

  it('renders an empty night with "nothing ran"', async () => {
    const res = await createApp(config()).request('/digest/2026-11-02');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('nothing ran');
  });

  it('keeps the good rows and says a line did not parse', async () => {
    const res = await createApp(config()).request('/digest/2026-11-03');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('a/job');
    expect(html).toContain('b/job');
    expect(html).toContain('did not parse');
  });
});

describe('GET /api/digest/:night (JSON)', () => {
  it('returns the DigestNight object, rows sorted by job', async () => {
    const res = await createApp(config()).request('/api/digest/2026-11-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestNight;
    expect(body).toEqual({
      night: '2026-11-01',
      rows: [
        {
          job: 'a/job',
          owner: 'rook',
          runs: 2,
          retries: 1,
          lastStatus: 'ok',
          lastError: 'timeout',
          first: '2026-11-01T02:00:00+01:00',
          last: '2026-11-01T02:05:00+01:00',
        },
        {
          job: 'digest/render',
          owner: 'rook',
          runs: 1,
          retries: 0,
          lastStatus: 'fail',
          lastError: 'quota exceeded',
          first: '2026-11-01T03:00:00+01:00',
          last: '2026-11-01T03:00:00+01:00',
        },
        {
          job: 'rig/rotate-logs',
          owner: 'rook',
          runs: 1,
          retries: 0,
          lastStatus: 'ok',
          lastError: null,
          first: '2026-11-01T01:00:00+01:00',
          last: '2026-11-01T01:00:00+01:00',
        },
      ],
      badLines: 0,
      counts: { ok: 2, retry: 1, fail: 1 },
    });
  });

  it('answers 404 with a JSON error for a night with no file', async () => {
    const res = await createApp(config()).request('/api/digest/2026-01-01');
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error?: unknown };
    expect(body).toHaveProperty('error');
  });

  it('returns an empty night with rows: []', async () => {
    const res = await createApp(config()).request('/api/digest/2026-11-02');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestNight;
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('counts the bad line and keeps the good rows', async () => {
    const res = await createApp(config()).request('/api/digest/2026-11-03');
    expect(res.status).toBe(200);
    const body = (await res.json()) as DigestNight;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['a/job', 'b/job']);
    expect(body.counts).toEqual({ ok: 2, retry: 0, fail: 0 });
  });
});

describe('page and JSON agree', () => {
  it('lists the jobs in the same order as rows.map(r => r.job)', async () => {
    const app = createApp(config());
    const html = await (await app.request('/digest/2026-11-01')).text();
    const body = (await (await app.request('/api/digest/2026-11-01')).json()) as DigestNight;
    const positions = body.rows.map((r) => html.indexOf(r.job));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
