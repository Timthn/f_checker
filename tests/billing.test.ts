import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataset, runStatus, startRun, accountData } from '../src/connectors/apify-rest';
import { runBillingEvidence, billingSummary, usdToMicrousd } from '../src/domain/billing';

beforeEach(() => {
  // Replace the environment surface entirely: never read developer credentials.
  vi.stubGlobal('process', { env: { APIFY_API_TOKEN: 'OFFLINE_TEST_TOKEN' } });
});
afterEach(() => vi.unstubAllGlobals());
const reply = (value: unknown, headers?: HeadersInit) => new Response(JSON.stringify(value), { headers });
const mockReply = (value: unknown) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply(value)));

it('rejects unrecognized run statuses without leaking the upstream payload', async () => {
  mockReply({ data: { status: 'PRIVATE_TOKEN', usageTotalUsd: 0.01 } });
  await expect(runStatus('OfflineRun')).rejects.toThrow(/^PROVIDER_SCHEMA_CHANGED$/);
});
it.each([-1, NaN, Infinity, '0.01', undefined, 1e20])('never treats invalid or missing usage %s as zero', async usageTotalUsd => {
  mockReply({ data: { status: 'FAILED', usageTotalUsd } });
  const run = await runStatus('OfflineRun');
  expect(run.usage).toBeUndefined();
  expect(run).toHaveProperty('usageMicrousd', null);
});
it('retains compatible numeric usage while returning safe microusd', async () => {
  mockReply({ data: { status: 'SUCCEEDED', usageTotalUsd: 0.00505, finishedAt: '2026-10-12T00:00:00Z', profile: 'PRIVATE_PROFILE' } });
  const run = await runStatus('OfflineRun');
  expect(run.usage).toBe(0.00505);
  expect(run).toHaveProperty('usageMicrousd', 5050);
  expect(JSON.stringify(run)).not.toContain('PRIVATE_PROFILE');
});
it('cancels an advertised oversized metadata response before reading it', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-length': '262145' } })));
  await expect(runStatus('OfflineRun')).rejects.toThrow(/^PROVIDER_RESPONSE_TOO_LARGE$/);
  expect(cancelled).toBe(true);
});
it('caps actual dataset bytes despite a false small content-length and cancels the stream', async () => {
  let cancelled = false;
  let reads = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { reads++; if (reads <= 4) controller.enqueue(new Uint8Array(1024 * 1024)); else controller.close(); },
    cancel() { cancelled = true; },
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-length': '1' } })));
  await expect(dataset('OfflineDataset')).rejects.toThrow(/^PROVIDER_RESPONSE_TOO_LARGE$/);
  expect(cancelled).toBe(true);
  expect(reads).toBeLessThanOrEqual(4);
});
it('uses the dataset byte allowance separately from smaller account metadata', async () => {
  const payload = [{ text: 'x'.repeat(300000) }];
  mockReply(payload);
  await expect(dataset('OfflineDataset')).resolves.toEqual(payload);
  mockReply(payload);
  await expect(accountData('limits')).rejects.toThrow(/^PROVIDER_RESPONSE_TOO_LARGE$/);
});
it('oversized POST response remains dispatch uncertain and never leaks private body', async () => {
  mockReply({ privateToken: 'x'.repeat(300000) });
  await expect(startRun({}, 20000)).rejects.toThrow(/^DISPATCH_UNCERTAIN$/);
});
it('rejects unsafe run ceilings before dispatch and rejects malformed run handles safely', async () => {
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  await expect(startRun({}, -1)).rejects.toThrow(/^INVALID_PROVIDER_CEILING$/);
  await expect(startRun({}, NaN)).rejects.toThrow(/^INVALID_PROVIDER_CEILING$/);
  expect(fetcher).not.toHaveBeenCalled();
  mockReply(null);
  await expect(startRun({}, 20000)).rejects.toThrow(/^DISPATCH_UNCERTAIN$/);
  mockReply({ data: { id: 'PRIVATE?token', defaultDatasetId: 'OfflineDataset' } });
  await expect(startRun({}, 20000)).rejects.toThrow(/^DISPATCH_UNCERTAIN$/);
});

const finished = '2026-10-12T00:00:00Z';
const metadata = { runId: 'OfflineRun', status: 'SUCCEEDED', usage: 0.00505, finishedAt: finished,
  pricingInfo: { pricingModel: 'PAY_PER_EVENT', pricingPerEvent: { actorChargeEvents: { 'actor-start': { eventPriceUsd: 0.00505, eventTitle: 'PRIVATE_TITLE', token: 'PRIVATE_TOKEN' } } }, profile: 'PRIVATE_PROFILE' },
  chargedEventCounts: { 'actor-start': 1 }, platformUsageBillingModel: 'USER', profile: 'PRIVATE_PROFILE' };
it.each([-1, NaN, Infinity, undefined, null, '0.01', 1e20])('pure cost conversion keeps invalid %s unknown', value => {
  expect(usdToMicrousd(value)).toBeNull();
});
it('a terminal response remains preliminary until a stable delayed observation', () => {
  const first = runBillingEvidence(metadata, '2026-10-12T00:00:01Z');
  expect(first.classification).toBe('reported_preliminary');
  expect(first.reported_microusd).toBe(5050);
  const early = runBillingEvidence(metadata, '2026-10-12T00:00:10Z', first);
  expect(early.classification).toBe('reported_preliminary');
  const stable = runBillingEvidence(metadata, '2026-10-12T00:00:11Z', first);
  expect(stable.classification).toBe('settled_observation');
  expect(stable.invoice_confirmed).toBe(false);
  expect(JSON.stringify(stable)).not.toContain('PRIVATE');
});
it.each(['FAILED', 'TIMED-OUT', 'ABORTED'])('retains delayed usage for terminal %s runs', status => {
  const first = runBillingEvidence({ ...metadata, status }, '2026-10-12T00:00:01Z');
  expect(runBillingEvidence({ ...metadata, status }, '2026-10-12T00:00:11Z', first).classification).toBe('settled_observation');
});
it('changed events, missing finish time, different run or running status cannot be stable evidence', () => {
  const first = runBillingEvidence(metadata, '2026-10-12T00:00:01Z');
  for (const change of [{ chargedEventCounts: { 'actor-start': 2 } }, { finishedAt: null }, { runId: 'DifferentRun' }, { status: 'RUNNING' }, { usage: undefined }]) {
    expect(runBillingEvidence({ ...metadata, ...change }, '2026-10-12T00:00:11Z', first).classification).not.toBe('settled_observation');
  }
});
it('retains only billing allowlisted fields and valid counts, never provider profiles or free text', () => {
  const evidence = runBillingEvidence({ ...metadata,
    chargedEventCounts: { 'actor-start': 1, 'page-crawled': -1, 'bad-count': 1.1, profile: 1, token: 2 },
    platformUsageBillingModel: 'PRIVATE_TOKEN',
    pricingInfo: { ...metadata.pricingInfo, pricePerUnitUsd: -1, reasonForChange: 'PRIVATE_REASON',
      tieredPricing: { FREE: { tieredPricePerUnitUsd: 0.00001, profile: 'PRIVATE_PROFILE' }, PRIVATE_TIER: { tieredPricePerUnitUsd: 1 } } },
  }, '2026-10-12T00:00:01Z');
  expect(evidence.charged_event_counts).toEqual({ 'actor-start': 1 });
  expect(evidence.platform_usage_billing_model).toBeNull();
  expect(evidence.pricing_info?.tieredPricing).toEqual({ FREE: { tieredPricePerUnitUsd: 0.00001 } });
  expect(evidence.pricing_info).not.toHaveProperty('pricePerUnitUsd');
  expect(JSON.stringify(evidence)).not.toContain('PRIVATE');
});
it('keeps explicit zero distinct from missing usage and safely rounds fractional microusd upward', () => {
  expect(usdToMicrousd(0)).toBe(0);
  expect(usdToMicrousd(0.0000001)).toBe(1);
  expect(usdToMicrousd(0.00007)).toBe(70);
  expect(runBillingEvidence({ ...metadata, usage: 0 }, '2026-10-12T00:00:01Z').reported_microusd).toBe(0);
  expect(runBillingEvidence({ ...metadata, usage: null }, '2026-10-12T00:00:01Z').classification).toBe('unknown');
});
it('never settles one late reading alone, nor reordered or future-finish observations', () => {
  expect(runBillingEvidence(metadata, '2026-10-12T00:00:20Z').classification).toBe('reported_preliminary');
  const future = { ...metadata, finishedAt: '2026-10-12T00:00:30Z' };
  const first = runBillingEvidence(future, '2026-10-12T00:00:01Z');
  expect(runBillingEvidence(future, '2026-10-12T00:00:20Z', first).classification).toBe('reported_preliminary');
  expect(runBillingEvidence(metadata, '2026-10-12T00:00:01Z', runBillingEvidence(metadata, '2026-10-12T00:00:20Z')).classification).toBe('reported_preliminary');
});
it('keeps reservations, estimates, reported app cost and unrelated account residual distinct', () => {
  expect(billingSummary({ reserved_microusd: 270000, reported_actor_microusd: 43450,
    measured_external_microusd: 1000, estimated_external_microusd: 4000, account_total_microusd: 100000 })).toEqual({
      reserved_microusd: 270000, reported_actor_microusd: 43450, measured_external_microusd: 1000,
      estimated_external_microusd: 4000, account_total_microusd: 100000, account_unattributed_residual_microusd: 55550,
      invoice_confirmed: false, exact_job_total_microusd: null,
    });
  expect(billingSummary({ reserved_microusd: 30000, account_total_microusd: 10000 }).account_unattributed_residual_microusd).toBeNull();
  expect(billingSummary({ reported_actor_microusd: 20000, measured_external_microusd: 0, account_total_microusd: 10000 }).account_unattributed_residual_microusd).toBeNull();
});
