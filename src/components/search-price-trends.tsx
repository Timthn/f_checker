'use client';
import {useState} from 'react';
import type {Offer,Search} from '@/domain/contracts';
import type {RouteHistorySnapshot} from '@/domain/route-history';
import {routeHistoryAverage,routeHistoryPlotPoints} from '@/domain/route-history-average';
import {en,zh,type MessageKey} from '@/i18n/catalog';
import {CalendarPanel} from './calendar-panel';
import {PriceChart} from './price-chart';
export function SearchPriceTrends({query,offer,owner,token,locale,routeHistory,fallbackPoints=[]}:{query:Search;offer:Offer|null;owner?:string;token?:string;locale:'en'|'zh-Hans';routeHistory?:RouteHistorySnapshot|null;fallbackPoints?:{day:string;minor:number|null}[]}){
 const [side,setSide]=useState<0|1>(0);const active=query.return_date?side:0,t=(k:MessageKey)=>(locale==='en'?en:zh)[k];
 const context:Search={...query,origin:active?query.destination:query.origin,destination:active?query.origin:query.destination,departure:active?query.return_date!:query.departure,return_date:undefined};
 const flights=offer?.segments.filter(s=>s.leg_index===active).map(s=>s.flight).join(' / ')??'—';const mean=routeHistoryAverage(routeHistory);
 const currency=routeHistory?.currency??query.currency,digits=routeHistory?.digits??(currency==='JPY'?0:2);
 return <section className="search-trends"><div className="chart-heading"><div><p className="eyebrow">{t(active?'returnLeg':'outboundLeg')} · {flights}</p><h3>{context.origin} → {context.destination} · {context.departure}</h3></div>{query.return_date&&<button type="button" onClick={()=>setSide(active?0:1)} aria-label={t(active?'showOutboundTrend':'showReturnTrend')}>{t(active?'showOutboundTrend':'showReturnTrend')} →</button>}</div><p className="muted">{t(query.return_date?'separateLegTrendNote':'singleLegTrendNote')}</p><CalendarPanel key={`${owner??'sample'}/${JSON.stringify(context)}`} query={context} owner={owner} token={token} locale={locale} fallbackPoints={!query.return_date?fallbackPoints:[]} fallbackCurrency={query.currency}/><details className="route-history-disclosure"><summary>{t(query.return_date?'combinationObservedHistory':'singleObservedHistory')}</summary><p className="muted">{t('meanScope')}</p><div className="route-average"><div><p>{t('historicalMean')}</p><strong>{mean.mean===null?'—':new Intl.NumberFormat(locale,{style:'currency',currency}).format(mean.mean/10**digits)}</strong></div><div><p>{t('sampleDays')}</p><b>{mean.count}</b></div><div><p>{t('historyWindow')}</p><b>{mean.from?`${mean.from} – ${mean.to}`:t('historyMissing')}</b></div></div>{routeHistory&&mean.count>0?<PriceChart points={routeHistoryPlotPoints(routeHistory)} label={t('routeHistory')} currency={currency} locale={locale} average={mean.mean}/>:<p>{t('routeNoHistory')}</p>}<p className="muted">{t('routeScope')}</p><p className="muted">{t('routeDates')}</p></details></section>;
}
