'use client';
import {useState,useCallback} from 'react';
import type {PriceWindow} from '@/domain/price-window';
export type TrendReport={key:string;window:PriceWindow};
import type {Offer,Search} from '@/domain/contracts';
import type {RouteHistorySnapshot} from '@/domain/route-history';
import {routeHistoryAverage,routeHistoryPlotPoints} from '@/domain/route-history-average';
import {en,zh,type MessageKey} from '@/i18n/catalog';
import {CalendarPanel} from './calendar-panel';
import {PriceChart} from './price-chart';
export function SearchPriceTrends({query,offer,owner,token,locale,routeHistory,fallbackPoints=[],reportKey,onWindow}:{query:Search;offer:Offer|null;owner?:string;token?:string;locale:'en'|'zh-Hans';routeHistory?:RouteHistorySnapshot|null;fallbackPoints?:{day:string;minor:number|null}[];reportKey?:string;onWindow?:(report:TrendReport)=>void}){
 const [side,setSide]=useState<'trip'|0|1>(query.return_date?'trip':0);const active=query.return_date?side:0,t=(k:MessageKey)=>(locale==='en'?en:zh)[k];
 const context:Search=active==='trip'?query:{...query,origin:active===1?query.destination:query.origin,destination:active===1?query.origin:query.destination,departure:active===1?query.return_date!:query.departure,return_date:undefined};
 const mode:PriceWindow['mode']=active==='trip'?'trip':active===1?'return':'outbound',next=active==='trip'?0:active===0?1:'trip';
 const receive=useCallback((data:Omit<PriceWindow,'mode'>)=>{if(reportKey)onWindow?.({key:reportKey,window:{...data,mode}});},[onWindow,reportKey,mode]);
 const flights=offer?.segments.filter(s=>active==='trip'||s.leg_index===active).map(s=>s.flight).join(' / ')??'—';const mean=routeHistoryAverage(routeHistory);
 const currency=routeHistory?.currency??query.currency,digits=routeHistory?.digits??(currency==='JPY'?0:2);
 return <section className="search-trends"><div className="chart-heading"><div><p className="eyebrow">{t(active==='trip'?'roundTripQuery':active===1?'returnLeg':'outboundLeg')} · {flights}</p><h3>{context.origin} → {context.destination} · {context.departure}{context.return_date?` ↔ ${context.return_date}`:''}</h3></div>{query.return_date&&<button type="button" onClick={()=>setSide(next)} aria-label={t(next==='trip'?'showTripTrend':next===0?'showOutboundTrend':'showReturnTrend')}>{t(next==='trip'?'showTripTrend':next===0?'showOutboundTrend':'showReturnTrend')} →</button>}</div><CalendarPanel key={`${owner??'sample'}/${JSON.stringify(context)}`} query={context} owner={owner} token={token} locale={locale} fallbackPoints={active==='trip'||!query.return_date?fallbackPoints:[]} onPrices={receive} fallbackCurrency={query.currency}/><details className="route-history-disclosure"><summary>{t(query.return_date?'combinationObservedHistory':'singleObservedHistory')}</summary><p className="muted">{t('meanScope')}</p><div className="route-average"><div><p>{t('historicalMean')}</p><strong>{mean.mean===null?'—':new Intl.NumberFormat(locale,{style:'currency',currency}).format(mean.mean/10**digits)}</strong></div><div><p>{t('sampleDays')}</p><b>{mean.count}</b></div><div><p>{t('historyWindow')}</p><b>{mean.from?`${mean.from} – ${mean.to}`:t('historyMissing')}</b></div></div>{routeHistory&&mean.count>0?<PriceChart points={routeHistoryPlotPoints(routeHistory)} label={t('routeHistory')} currency={currency} locale={locale} average={mean.mean}/>:<p>{t('routeNoHistory')}</p>}<p className="muted">{t('routeScope')}</p><p className="muted">{t('routeDates')}</p></details></section>;
}
