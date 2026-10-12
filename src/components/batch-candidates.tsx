'use client';
import type {Offer,Search} from '@/domain/contracts';
import {useState} from 'react';
import {en,zh,type MessageKey} from '@/i18n/catalog';

type Group={ordinal:number;participants:('a'|'b'|'dates')[];query:Search;offers:Offer[];returned_count:number;omitted_count:number};
/** Saved candidates are evidence for inspection, never verified recommendations. */
export function BatchCandidates({groups,locale}:{groups:Group[];locale:'en'|'zh-Hans'}){
 const t=(key:MessageKey)=>(locale==='en'?en:zh)[key];
 const [now,setNow]=useState(()=>Date.now());
 const freshness=(o:Offer):MessageKey=>{const seen=Date.parse(o.observed_at),expiry=Date.parse(o.expires_at);return !Number.isFinite(seen)||!Number.isFinite(expiry)||seen>now?'batchFreshUnknown':expiry<=now||now-seen>86400000?'batchStale':'batchFreshUnverified';};
 if(!groups.some(g=>g.offers.length))return null;
 return <details onToggle={()=>setNow(Date.now())}><summary>{t('batchCandidates')}</summary><p className="muted">{t('batchCandidatesNote')}</p>{groups.filter(g=>g.offers.length).map(g=><section key={g.ordinal} aria-label={`${g.query.origin} ${g.query.destination} ${g.query.departure}`}><h3>{g.query.origin} → {g.query.destination} · {g.query.departure}{g.query.return_date?` / ${g.query.return_date}`:''}</h3><p>{g.offers.length} / {g.returned_count} · {t('batchShownReturned')}</p><div className="fare-list">{g.offers.map(o=><div className="fare-row" key={o.offer_id}><span>{o.segments.map(s=>s.flight).join(' / ')}<small>{o.segments[0]?.departure_local.replace('T',' ')} · {t(o.complete?'batchJourneyPresent':'batchJourneyPartial')}</small><small>{t(freshness(o))} · {o.observed_at??'—'}</small></span><strong>{new Intl.NumberFormat(locale,{style:'currency',currency:o.money.currency,maximumFractionDigits:o.money.digits}).format(o.money.minor/10**o.money.digits)}</strong><span>{t('unverifiedTotal')}<small>{t(o.quote_evidence?.state==='source_fields_matched'?'quoteSourceMatched':'quoteSourceUnverified')}</small></span></div>)}</div></section>)}</details>;
}
