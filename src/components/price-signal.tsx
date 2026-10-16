import type {Search} from '@/domain/contracts';
import type {RouteHistorySnapshot} from '@/domain/route-history';
import {providerPriceSignal,summarizePriceWindow,type PriceWindow} from '@/domain/price-window';
import {en,zh,type MessageKey} from '@/i18n/catalog';
export function PriceSignal({query,history,windows,locale}:{query:Search;history?:RouteHistorySnapshot|null;windows:Partial<Record<PriceWindow['mode'],PriceWindow>>;locale:'en'|'zh-Hans'}){
 const t=(k:MessageKey)=>(locale==='en'?en:zh)[k],tag=providerPriceSignal(history);
 const modes:PriceWindow['mode'][]=query.return_date?['trip','outbound','return']:['outbound'];
 const mode=modes.find(k=>summarizePriceWindow(windows[k]).count>0)??modes[0],window=windows[mode],stats=summarizePriceWindow(window);
 const currency=window?.currency??query.currency,digits=new Intl.NumberFormat(locale,{style:'currency',currency}).resolvedOptions().maximumFractionDigits??2;
 const fmt=(n:number|null)=>n===null?'—':new Intl.NumberFormat(locale,{style:'currency',currency}).format(n/10**digits);
 return <><p className="eyebrow">{t('signal')}</p><h2>{t(tag==='low'?'sourcePriceLow':tag==='high'?'sourcePriceHigh':tag==='typical'?'sourcePriceTypical':'datePriceStatistics')}</h2>{tag&&<p className="muted">{t('sourcePriceTag')} · {history?.observed_at.slice(0,10)}</p>}<p className="signal-scope">{t(mode==='trip'?'tripDateStats':mode==='return'?'returnDateStats':'outboundDateStats')}</p><dl className="signal-statistics"><div><dt>{t('mean')}</dt><dd>{fmt(stats.mean)}</dd></div><div><dt>{t('medianPrice')}</dt><dd>{fmt(stats.median)}</dd></div></dl><p className="muted">{stats.count?`${t('sampleDays')} · ${stats.count} / 31`:t('loadDateStats')}</p></>;
}
