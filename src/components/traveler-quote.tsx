import type {Offer,Money} from '@/domain/contracts';
import {en,zh,type MessageKey} from '@/i18n/catalog';
import {FlightJourney} from './flight-journey';
export type SeparateTravelerPair={a:Offer;b:Offer;total:Money;nights:number;preferences:{carry_on:number;checked:number}[]};
export function IncludedBags({offer,locale}:{offer:Offer;locale:'en'|'zh-Hans'}){
 const t=(k:MessageKey)=>(locale==='en'?en:zh)[k];
 const complete=offer.segments.length>0&&!offer.baggage.some(b=>b.passenger===0&&b.contradictory)&&offer.segments.every((_,i)=>offer.baggage.some(b=>b.segment===i&&b.passenger===0&&!b.contradictory&&b.carry_on!==null&&b.checked!==null&&Number.isSafeInteger(b.carry_on)&&Number.isSafeInteger(b.checked)&&b.carry_on>=0&&b.checked>=0&&[b.carry_kg,b.checked_kg].every(w=>w===null||Number.isFinite(w)&&w>=0)));
 return <small className="included-bags">{t('includedLabel')} · {complete?t('bagSeeSegments'):t('bagNotProvided')}{complete&&<span>{offer.segments.map((_,i)=>{const b=offer.baggage.find(b=>b.segment===i&&b.passenger===0&&!b.contradictory)!;return <span key={i}>{t('segmentLabel')} {i+1}: {t('carry')} {b.carry_on} ({b.carry_kg??'—'} kg), {t('checked')} {b.checked} ({b.checked_kg??'—'} kg)</span>;})}</span>}</small>;
}
export function TravelerQuote({offer,locale,requested}:{offer:Offer;locale:'en'|'zh-Hans';requested?:{carry_on:number;checked:number}}){
 const t=(k:MessageKey)=>(locale==='en'?en:zh)[k];
 return <><FlightJourney segments={offer.segments} locale={locale}/><p className="individual-price"><span>{t('individualSourceQuote')}</span><b>{new Intl.NumberFormat(locale,{style:'currency',currency:offer.money.currency}).format(offer.money.minor/10**offer.money.digits)}</b></p>{requested&&<small>{t('requestedLabel')} · {t('carry')} {requested.carry_on} / {t('checked')} {requested.checked}</small>}<IncludedBags offer={offer} locale={locale}/></>;
}
export function SeparateTravelerQuote({pair,locale}:{pair:SeparateTravelerPair;locale:'en'|'zh-Hans'}){
 const t=(k:MessageKey)=>(locale==='en'?en:zh)[k];
 return <article className="fare-row separated-quote">{(['a','b'] as const).map((side,i)=><div key={side}><p className="eyebrow">{t(side==='a'?'travelerA':'travelerB')}</p><TravelerQuote offer={pair[side]} locale={locale} requested={pair.preferences[i]}/></div>)}<div className="separated-total"><p>{t('independentTotal')}</p><strong>{new Intl.NumberFormat(locale,{style:'currency',currency:pair.total.currency}).format(pair.total.minor/10**pair.total.digits)}</strong><p>{pair.nights} {t('nights')}</p><small>{t('combinedIncludesNote')}</small><small>{t('independentQuoteNotice')}</small></div></article>;
}
