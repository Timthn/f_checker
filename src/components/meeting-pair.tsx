import type {Offer} from '@/domain/contracts';
import {en,zh,type MessageKey} from '@/i18n/catalog';
import {presentLocalTime} from '@/domain/flight-presentation';
import {FlightJourney} from './flight-journey';
import {TravelerQuote} from './traveler-quote';
type Pair={a:Offer;b:Offer;total:number;gap:number;arrival_a?:string;arrival_b?:string;zone?:string|null};
export function MeetingPair({pair,locale,reference=false}:{pair:Pair;locale:'en'|'zh-Hans';reference?:boolean}){
 const t=(k:MessageKey)=>(locale==='en'?en:zh)[k];
 const amount=new Intl.NumberFormat(locale,{style:'currency',currency:pair.a.money.currency}).format(pair.total/10**pair.a.money.digits);
 return <div className="fare-row meeting-pair">{(['a','b'] as const).map(side=>{const arrival=side==='a'?pair.arrival_a:pair.arrival_b,local=arrival?presentLocalTime(arrival,locale):null;return <div className={`meeting-side meeting-${side}`} key={side}><span className="eyebrow">{t(side==='a'?'travelerA':'travelerB')}</span><TravelerQuote offer={pair[side]} locale={locale}/>{reference&&local&&<small className="meeting-local">{t('referenceClock')} · {local.date} {local.clock} · {pair.zone??t('unknown')}</small>}</div>;})}<div className="meeting-total"><span>{t('meetingDisplayedTotal')}</span><strong>{amount}</strong><small>{t('combinedIncludesNote')}</small>{reference&&<small>{t('independentQuoteNotice')}</small>}</div><div className="meeting-gap"><span>{t('meetingArrivalGap')}</span><b>{pair.gap} {t('batchMinutes')}</b>{reference&&<small>{t('unknown')}</small>}</div></div>;
}
