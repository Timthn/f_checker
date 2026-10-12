import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn(), authenticate: vi.fn() }));
vi.mock('../src/server/db', () => ({ transaction: mocks.transaction }));
vi.mock('../src/server/auth', () => ({ authenticate: mocks.authenticate }));
import { ownerUsage, presentUsage, usageMonth } from '../src/server/usage';
import { GET } from '../src/app/api/v1/usage/route';
import { fetchUsage } from '../src/components/usage-panel';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UsagePanel } from '../src/components/usage-panel';
const now = new Date('2026-10-31T16:00:00Z');
const totals = { run_count: '2', uncertain_dispatch_count: '1', known_cost_call_count: '1', unknown_cost_call_count: '2', reported_subtotal_microusd: '5050', reserved_ceiling_microusd: '120000' };
beforeEach(() => { vi.resetAllMocks(); mocks.transaction.mockImplementation(async (_kind, _owner, fn) => fn({ query: mocks.query })); mocks.query.mockResolvedValue({ rows: [totals] }); mocks.authenticate.mockResolvedValue('owner-a'); });
it('uses exclusive Hong Kong month boundaries including the UTC month rollover', () => {
  expect(usageMonth(now)).toEqual({ month: '2026-11', timezone: 'Asia/Hong_Kong', period_start: '2026-10-31T16:00:00Z', period_end: '2026-11-30T16:00:00Z' });
  expect(usageMonth(new Date('2026-10-31T15:59:59Z')).month).toBe('2026-10');
  expect(usageMonth(new Date('2026-12-31T16:00:00Z')).period_end).toBe('2027-01-31T16:00:00Z');
});
it('keeps known subtotal, unknown attempts and ceilings separate from USD5 reference balance', () => {
  const usage = presentUsage(totals, now);
  expect(usage.run_count).toBe(2); expect(usage.uncertain_dispatch_count).toBe(1);
  expect(usage.unknown_cost_call_count).toBe(2); expect(usage.reported_subtotal_microusd).toBe(5050);
  expect(usage.reserved_ceiling_microusd).toBe(120000); expect(usage.monthly_reference_budget_microusd).toBe(5000000);
  expect(usage.reference_used_percent).toBe(0.101); expect(usage.invoice_confirmed).toBe(false); expect(usage.account_remaining_verified).toBe(false);
  expect(usage).not.toHaveProperty('remaining_microusd');
});
it('handles an empty month without fabricating incurred cost from reservations', () => {
  const usage = presentUsage({ run_count: '0', uncertain_dispatch_count: '0', known_cost_call_count: '0', unknown_cost_call_count: '0', reported_subtotal_microusd: '0', reserved_ceiling_microusd: '90000' }, now);
  expect(usage.run_count).toBe(0); expect(usage.reported_subtotal_microusd).toBe(0); expect(usage.reserved_ceiling_microusd).toBe(90000);
});
it('refuses inconsistent or unsafe aggregate evidence instead of displaying zero', () => {
  expect(() => presentUsage({ ...totals, reported_subtotal_microusd: '-1' }, now)).toThrow('USAGE_EVIDENCE_INVALID');
  expect(() => presentUsage({ ...totals, reported_subtotal_microusd: '9007199254740992' }, now)).toThrow('USAGE_EVIDENCE_INVALID');
  expect(() => presentUsage({ ...totals, unknown_cost_call_count: '0' }, now)).toThrow('USAGE_EVIDENCE_INVALID');
});
it('restricts the read-only aggregate to the authenticated owner and half-open period', async () => {
  const usage = await ownerUsage('owner-a', now);
  expect(mocks.transaction).toHaveBeenCalledWith('worker', null, expect.any(Function));
  const [sql, params] = mocks.query.mock.calls[0];
  expect(params).toEqual(['owner-a', '2026-10-31T16:00:00Z', '2026-11-30T16:00:00Z']);
  expect(sql).toContain('owner_id=$1'); expect(sql).toContain('created_at < $3::timestamptz');
  expect(sql).not.toMatch(/\b(insert|update|delete)\b/i); expect(usage).not.toHaveProperty('run_id');
});
it('private GET rejects unauthenticated access without touching the database', async () => {
  mocks.authenticate.mockResolvedValue(null);
  expect((await GET(new Request('http://localhost/api/v1/usage'))).status).toBe(401);
  expect(mocks.transaction).not.toHaveBeenCalled();
});
it('private GET excludes token and supplier handles and disables HTTP cache', async () => {
  const response = await GET(new Request('http://localhost/api/v1/usage', { headers: { Authorization: 'Bearer OFFLINE_ONLY' } }));
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('vary')).toBe('Authorization'); expect(JSON.stringify(await response.json())).not.toContain('OFFLINE_ONLY');
});
it('panel refresh reads existing usage with GET and never starts a paid provider query', async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json(presentUsage(totals, now)));
  vi.stubGlobal('fetch', fetcher);
  try { const signal = new AbortController().signal; await fetchUsage('OFFLINE_ONLY', signal);
    expect(fetcher).toHaveBeenCalledWith('/api/v1/usage', { method: 'GET', headers: { Authorization: 'Bearer OFFLINE_ONLY' }, signal, cache: 'no-store' });
  } finally { vi.unstubAllGlobals(); }
});
it('signed-out panel shows the sign-in state and does not fetch or display private totals', () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const client = new QueryClient();
  try {
    const markup = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(UsagePanel, { locale: 'en' })));
    expect(markup).toContain('Sign in to view your usage.');
    expect(markup).not.toContain('Recorded reservation ceilings');
    expect(fetcher).not.toHaveBeenCalled();
  } finally { client.clear(); vi.unstubAllGlobals(); }
});
it('percentage stays bounded when reported spend exceeds the reference without claiming a negative account balance', () => {
  const summary = presentUsage({ ...totals, reported_subtotal_microusd: '6000000' }, now);
  expect(summary.reference_used_percent).toBe(100);
  expect(summary.reported_subtotal_microusd).toBe(6000000);
  expect(summary.account_remaining_verified).toBe(false);
});
