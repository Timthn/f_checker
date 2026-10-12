import type {Offer} from '@/domain/contracts';
import {en,zh,type MessageKey} from '@/i18n/catalog';
const links:Record<string,{name:string;url:string}>={GK:{name:'Jetstar',url:'https://www.jetstar.com/jp/en/flights/baggage/checked-baggage'},UO:{name:'HK Express',url:'https://www.hkexpress.com/en-HK/Plan/Fare/Fare-Categories'},HB:{name:'Greater Bay Airlines',url:'https://www.greaterbay-airlines.com/hk/en/manage/our-services/baggage.html'}};
export function QuoteBaggage({offer,locale}:{offer:Offer|null;locale:'en'|'zh-Hans'}){
 const t=(k:MessageKey)=>(locale==='en'?en:zh)[k];const codes=[...new Set(offer?.segments.map(s=>s.airline_code||/^([A-Z0-9]{2})\s*\d/.exec(s.flight)?.[1]).filter((s):s is string=>!!s)??[])];
 return <><h2>{t('quoteBaggage')}</h2><div className="baggage-cards">{(['carry','checked'] as const).map(k=><div key={k}><span>{t(k)}</span><b>{t(offer?.baggage.some(b=>!b.contradictory&&(k==='carry'?b.carry_on:b.checked)!==null)?'bagSeeSegments':'bagNotProvided')}</b><small>{t('bagQuoteUnconfirmed')}</small></div>)}</div>
  <p className="muted">{t('bagQuoteHelp')}</p>{offer?.baggage.map((b,i)=><p key={i}>{t('source')} · {b.segment+1} / {b.passenger+1} · {t('carry')} {b.carry_on??'—'} ({b.carry_kg??'—'} kg) · {t('checked')} {b.checked??'—'} ({b.checked_kg??'—'} kg) · {t(b.contradictory?'unknown':'quotedEvidence')}</p>)}
  <div className="baggage-links">{codes.filter(c=>links[c]).map(c=><a key={c} href={links[c].url} target="_blank" rel="noopener noreferrer">{links[c].name} · {t('officialBaggage')} ↗</a>)}</div><p className="muted">{t('bagRulesOnly')}</p>
 </>;
}
