'use client';
import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { UsageSummary } from '@/server/usage';

export const usageCatalog = {
  en: { usageTitle: 'Apify usage', usageMonth: 'This month · Hong Kong time', usageSignIn: 'Sign in to view your usage.',
    usageLoading: 'Loading usage…', usageError: 'Usage is unavailable. Try refreshing.', usageRefresh: 'Refresh usage',
    usageRuns: 'Provider runs started', usageUncertain: 'Dispatches awaiting confirmation', usageReported: 'Reported run cost',
    usageKnown: 'Runs with a reported cost', usageUnknown: 'Run costs still unknown', usageBudget: 'Monthly reference budget',
    usageBudgetNote: 'The USD5 reference is compared with your saved run costs. It is not a verified account balance or final invoice.',
    usageScope: 'Your saved records only, grouped by creation month. Other account activity and read, transfer or storage charges may be missing.',
    usageRange: 'Flexible dates: explore 3 date pairs by default, up to 8. This searches a sample, not every possible combination.', usageCeiling: 'Recorded reservation ceilings', usageDetails: 'Calculation details' },
  'zh-Hans': { usageTitle: 'Apify 用量', usageMonth: '本月 · 香港时间', usageSignIn: '登录后查看你的用量。',
    usageLoading: '正在加载用量…', usageError: '暂时无法读取用量，请刷新重试。', usageRefresh: '刷新用量',
    usageRuns: '已启动的供应商调用', usageUncertain: '尚待确认的调用尝试', usageReported: '供应商已报告费用',
    usageKnown: '已有费用报告的调用', usageUnknown: '费用尚不明确的调用', usageBudget: '每月参考预算',
    usageBudgetNote: 'USD5 参考额度仅与已保存的调用费用比较，不代表已核实的账户余额或最终账单。',
    usageScope: '仅统计你的已保存记录，按记录创建月份归类；其他账户活动及读取、传输和存储费用可能尚未包含。',
    usageRange: '灵活日期默认探索 3 个日期组合，最多 8 个；抽样搜索，不遍历全部组合。', usageCeiling: '记录的预留费用上限', usageDetails: '统计说明' },
} as const;

export async function fetchUsage(token: string, signal?: AbortSignal): Promise<UsageSummary> {
  const response = await fetch('/api/v1/usage', { method: 'GET', headers: { Authorization: `Bearer ${token}` }, signal, cache: 'no-store' });
  if (!response.ok) throw Error('USAGE_UNAVAILABLE');
  return response.json() as Promise<UsageSummary>;
}
let usageIdentity = 0;
export function UsagePanel({ locale, token, owner }: { locale: 'en' | 'zh-Hans'; token?: string; owner?: string }) {
  const t = usageCatalog[locale], client = useQueryClient(), identity = useMemo(() => ++usageIdentity, [owner, token]);
  const query = useQuery({ queryKey: ['usage', owner ?? 'signed-out', identity], enabled: !!owner && !!token, retry: false,
    staleTime: 0, gcTime: 0, refetchOnWindowFocus: false,
    queryFn: ({ signal }) => fetchUsage(token!, signal) });
  useEffect(() => () => {
    void client.cancelQueries({ queryKey: ['usage', owner ?? 'signed-out', identity], exact: true });
    client.removeQueries({ queryKey: ['usage', owner ?? 'signed-out', identity], exact: true });
  }, [client, owner, identity]);
  // A new identity cannot show the old owner's/session's cached data, even for one render.
  const data = owner && token ? query.data : undefined;
  const usd = (micro: number) => new Intl.NumberFormat(locale === 'en' ? 'en-HK' : 'zh-Hans-HK', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }).format(micro / 1000000);
  return <section className="usage-panel" aria-label={t.usageTitle}>
    <div className="result-header"><div><p className="eyebrow">{t.usageMonth}</p><h2>{t.usageTitle}</h2></div>
      {owner && token && <button type="button" disabled={query.isFetching} onClick={() => void query.refetch()}>{t.usageRefresh}</button>}</div>
    {!owner || !token ? <p className="muted">{t.usageSignIn}</p> : query.isError ? <p role="alert">{t.usageError}</p> : !data ? <p role="status">{t.usageLoading}</p> : <>
      <p className="muted">{data.month}</p>
      <div className="usage-cards">
        <section className="card metric"><p>{t.usageRuns}</p><strong>{data.run_count}</strong>{data.uncertain_dispatch_count > 0 && <p className="muted">{t.usageUncertain} · {data.uncertain_dispatch_count}</p>}</section>
        <section className="card metric"><p>{t.usageReported}</p><strong>{usd(data.reported_subtotal_microusd)}</strong><p className="muted">{t.usageKnown} · {data.known_cost_call_count}{data.unknown_cost_call_count > 0 && <> / {t.usageUnknown} · {data.unknown_cost_call_count}</>}</p></section>
        <section className="card metric"><p>{t.usageBudget}</p><strong>{usd(data.monthly_reference_budget_microusd)}</strong><progress className="usage-progress" value={data.reference_used_percent} max={100} aria-label={t.usageBudget} /><p className="muted">{t.usageBudgetNote}</p></section>
      </div>
      <details className="usage-details"><summary>{t.usageDetails}</summary><p className="muted">{t.usageScope}</p><p>{t.usageCeiling} · {usd(data.reserved_ceiling_microusd)}</p></details>
    </>}
    <p className="muted usage-range-note">{t.usageRange}</p>
  </section>;
}
