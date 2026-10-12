import { Temporal } from '@js-temporal/polyfill';
import { transaction } from './db';

export function usageMonth(now = new Date()) {
  const local = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO('Asia/Hong_Kong');
  const start = local.with({ day: 1, hour: 0, minute: 0, second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 });
  return { month: `${start.year}-${String(start.month).padStart(2, '0')}`, timezone: 'Asia/Hong_Kong' as const,
    period_start: start.toInstant().toString(), period_end: start.add({ months: 1 }).toInstant().toString() };
}
function amount(value: unknown): number {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isSafeInteger(parsed) || parsed < 0) throw Error('USAGE_EVIDENCE_INVALID');
  return parsed;
}
export type UsageTotals = { run_count: unknown; uncertain_dispatch_count: unknown; known_cost_call_count: unknown; unknown_cost_call_count: unknown; reported_subtotal_microusd: unknown; reserved_ceiling_microusd: unknown };
export function presentUsage(totals: UsageTotals, now = new Date()) {
  const run_count = amount(totals.run_count), uncertain_dispatch_count = amount(totals.uncertain_dispatch_count),
    known_cost_call_count = amount(totals.known_cost_call_count), unknown_cost_call_count = amount(totals.unknown_cost_call_count),
    reported_subtotal_microusd = amount(totals.reported_subtotal_microusd), reserved_ceiling_microusd = amount(totals.reserved_ceiling_microusd);
  if (known_cost_call_count + unknown_cost_call_count !== run_count + uncertain_dispatch_count) throw Error('USAGE_EVIDENCE_INVALID');
  return { ...usageMonth(now), observed_at: now.toISOString(), run_count, uncertain_dispatch_count,
    known_cost_call_count, unknown_cost_call_count, reported_subtotal_microusd, reserved_ceiling_microusd,
    monthly_reference_budget_microusd: 5000000, reference_used_percent: Math.min(100, reported_subtotal_microusd / 50000),
    invoice_confirmed: false as const, account_remaining_verified: false as const,
    period_basis: 'provider_call_created_at' as const };
}
export type UsageSummary = ReturnType<typeof presentUsage>;

// Existing API role cannot read provider_calls. Worker access is read-only here,
// with explicit owner filtering; supplier IDs and account-wide totals never leave it.
export async function ownerUsage(owner: string, now = new Date()): Promise<UsageSummary> {
  const period = usageMonth(now);
  return transaction('worker', null, async c => {
    const result = await c.query(`with calls as (
      select run_id,phase,reported_microusd,ceiling_microusd,
        (run_id is not null or phase in ('dispatching','uncertain')) as attempted
      from flight.provider_calls where owner_id=$1 and created_at >= $2::timestamptz and created_at < $3::timestamptz
    ) select count(*) filter(where run_id is not null) as run_count,
      count(*) filter(where run_id is null and phase in ('dispatching','uncertain')) as uncertain_dispatch_count,
      count(*) filter(where attempted and reported_microusd is not null) as known_cost_call_count,
      count(*) filter(where attempted and reported_microusd is null) as unknown_cost_call_count,
      coalesce(sum(reported_microusd) filter(where attempted),0) as reported_subtotal_microusd,
      coalesce(sum(ceiling_microusd),0) as reserved_ceiling_microusd from calls`, [owner, period.period_start, period.period_end]);
    return presentUsage(result.rows[0] as UsageTotals, now);
  });
}
