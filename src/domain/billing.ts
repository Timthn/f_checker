import Decimal from 'decimal.js';

export const runStatuses = ['READY', 'RUNNING', 'SUCCEEDED', 'FAILED', 'TIMING-OUT', 'TIMED-OUT', 'ABORTING', 'ABORTED'] as const;
export type RunStatus = typeof runStatuses[number];
const terminalStatuses: readonly string[] = ['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'];
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const microusd = (value: unknown): number | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
export function usdToMicrousd(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const amount = new Decimal(value).mul(1000000).ceil();
  return amount.lte(Number.MAX_SAFE_INTEGER) ? amount.toNumber() : null;
}
function timestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) return null;
  return new Date(value).toISOString();
}
const eventKey = (key: string) => /^[a-z][a-z0-9-]{0,63}$/.test(key) && !/token|profile|secret|credential|password/.test(key);
function eventCounts(value: unknown): Record<string, number> | null {
  const input = record(value); if (!input) return null;
  return Object.fromEntries(Object.entries(input).filter(([key, count]) => eventKey(key) && microusd(count) !== null).sort(([a], [b]) => a.localeCompare(b)).slice(0, 64)) as Record<string, number>;
}
export interface PricingInfo {
  pricingModel: 'PAY_PER_EVENT' | 'PRICE_PER_DATASET_ITEM' | 'FLAT_PRICE_PER_MONTH' | 'FREE';
  createdAt?: string;
  startedAt?: string;
  apifyMarginPercentage?: number;
  minimalMaxTotalChargeUsd?: number;
  pricePerUnitUsd?: number;
  pricingPerEvent?: { actorChargeEvents: Record<string, { eventPriceUsd?: number; eventTieredPricingUsd?: Record<string, { tieredEventPriceUsd: number }>; isPrimaryEvent?: boolean; isOneTimeEvent?: boolean }> };
  tieredPricing?: Record<string, { tieredPricePerUnitUsd: number }>;
}
const tiers = ['FREE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND'];
function tierPrices(value: unknown, field: 'tieredEventPriceUsd' | 'tieredPricePerUnitUsd') {
  const input = record(value); if (!input) return undefined;
  const result: Record<string, Record<string, number>> = {};
  for (const tier of tiers) { const price = record(input[tier])?.[field]; if (usdToMicrousd(price) !== null) result[tier] = { [field]: price as number }; }
  return result;
}
function pricingInfo(value: unknown): PricingInfo | null {
  const input = record(value);
  if (!input || !['PAY_PER_EVENT', 'PRICE_PER_DATASET_ITEM', 'FLAT_PRICE_PER_MONTH', 'FREE'].includes(String(input.pricingModel))) return null;
  const output: PricingInfo = { pricingModel: input.pricingModel as PricingInfo['pricingModel'] };
  for (const key of ['createdAt', 'startedAt'] as const) { const time = timestamp(input[key]); if (time) output[key] = time; }
  if (typeof input.apifyMarginPercentage === 'number' && Number.isFinite(input.apifyMarginPercentage) && input.apifyMarginPercentage >= 0 && input.apifyMarginPercentage <= 1) output.apifyMarginPercentage = input.apifyMarginPercentage;
  for (const key of ['minimalMaxTotalChargeUsd', 'pricePerUnitUsd'] as const) if (usdToMicrousd(input[key]) !== null) output[key] = input[key] as number;
  const events = record(record(input.pricingPerEvent)?.actorChargeEvents);
  if (events) {
    const safeEvents: NonNullable<PricingInfo['pricingPerEvent']>['actorChargeEvents'] = {};
    for (const key of Object.keys(events).filter(eventKey).sort().slice(0, 64)) {
      const event = record(events[key]); if (!event) continue;
      const safe: typeof safeEvents[string] = {};
      if (usdToMicrousd(event.eventPriceUsd) !== null) safe.eventPriceUsd = event.eventPriceUsd as number;
      const tiered = tierPrices(event.eventTieredPricingUsd, 'tieredEventPriceUsd');
      if (tiered) safe.eventTieredPricingUsd = tiered as Record<string, { tieredEventPriceUsd: number }>;
      for (const flag of ['isPrimaryEvent', 'isOneTimeEvent'] as const) if (typeof event[flag] === 'boolean') safe[flag] = event[flag];
      safeEvents[key] = safe;
    }
    output.pricingPerEvent = { actorChargeEvents: safeEvents };
  }
  const tiered = tierPrices(input.tieredPricing, 'tieredPricePerUnitUsd');
  if (tiered) output.tieredPricing = tiered as Record<string, { tieredPricePerUnitUsd: number }>;
  return output;
}
export function safeRunBillingMetadata(value: unknown) {
  const input = record(value);
  if (!input || typeof input.status !== 'string' || !runStatuses.includes(input.status as RunStatus)) throw Error('PROVIDER_SCHEMA_CHANGED');
  const usageValue = 'usageTotalUsd' in input ? input.usageTotalUsd : input.usage;
  const usageMicrousd = usdToMicrousd(usageValue);
  const rawId = input.runId ?? input.id;
  return {
    runId: typeof rawId === 'string' && /^[A-Za-z0-9]{1,64}$/.test(rawId) ? rawId : null,
    status: input.status as RunStatus,
    usage: usageMicrousd === null ? undefined : usageValue as number,
    usageMicrousd,
    finishedAt: timestamp(input.finishedAt),
    pricingInfo: pricingInfo(input.pricingInfo),
    chargedEventCounts: eventCounts(input.chargedEventCounts),
    platformUsageBillingModel: input.platformUsageBillingModel === 'USER' || input.platformUsageBillingModel === 'DEVELOPER' ? input.platformUsageBillingModel : null,
  };
}
export interface RunBillingEvidence {
  run_id: string | null;
  status: RunStatus;
  observed_at: string;
  finished_at: string | null;
  reported_microusd: number | null;
  classification: 'unknown' | 'reported_preliminary' | 'settled_observation';
  pricing_info: PricingInfo | null;
  charged_event_counts: Record<string, number> | null;
  platform_usage_billing_model: string | null;
  invoice_confirmed: false;
}
// A delayed repeat is an observation of stable API metadata, never invoice evidence.
export function runBillingEvidence(metadata: unknown, observedAt: string, previous?: RunBillingEvidence): RunBillingEvidence {
  const run = safeRunBillingMetadata(metadata), observed = timestamp(observedAt);
  if (!observed) throw Error('INVALID_BILLING_OBSERVATION_TIME');
  const evidence: RunBillingEvidence = {
    run_id: run.runId, status: run.status, observed_at: observed, finished_at: run.finishedAt,
    reported_microusd: run.usageMicrousd, classification: run.usageMicrousd === null ? 'unknown' : 'reported_preliminary',
    pricing_info: run.pricingInfo, charged_event_counts: run.chargedEventCounts,
    platform_usage_billing_model: run.platformUsageBillingModel, invoice_confirmed: false,
  };
  if (previous && run.runId && previous.run_id === run.runId && terminalStatuses.includes(run.status) && previous.status === run.status && run.finishedAt && previous.finished_at === run.finishedAt &&
      run.usageMicrousd !== null && previous.reported_microusd === run.usageMicrousd &&
      Date.parse(observed) - Date.parse(run.finishedAt) >= 10000 && Date.parse(observed) - Date.parse(previous.observed_at) >= 10000 && Date.parse(previous.observed_at) >= Date.parse(run.finishedAt) &&
      JSON.stringify(previous.pricing_info) === JSON.stringify(evidence.pricing_info) && JSON.stringify(previous.charged_event_counts) === JSON.stringify(evidence.charged_event_counts) && previous.platform_usage_billing_model === evidence.platform_usage_billing_model) {
    evidence.classification = 'settled_observation';
  }
  return evidence;
}
export function billingSummary(input: { reserved_microusd?: unknown; reported_actor_microusd?: unknown; measured_external_microusd?: unknown; estimated_external_microusd?: unknown; account_total_microusd?: unknown }) {
  const reserved = microusd(input.reserved_microusd), reported = microusd(input.reported_actor_microusd), measured = microusd(input.measured_external_microusd), estimate = microusd(input.estimated_external_microusd), account = microusd(input.account_total_microusd);
  const attributable = reported !== null && measured !== null && Number.isSafeInteger(reported + measured) ? reported + measured : null;
  return {
    reserved_microusd: reserved, reported_actor_microusd: reported, measured_external_microusd: measured,
    estimated_external_microusd: estimate, account_total_microusd: account,
    account_unattributed_residual_microusd: account !== null && attributable !== null && account >= attributable ? account - attributable : null,
    invoice_confirmed: false as const, exact_job_total_microusd: null,
  };
}
