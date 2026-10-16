import type {Offer} from '@/domain/contracts';
import {en,zh,type MessageKey} from '@/i18n/catalog';
export function FlightRights({offer,adults,locale}:{offer:Offer|null;adults:number;locale:'en'|'zh-Hans'}){
 const t=(k:MessageKey)=>(locale==='en'?en:zh)[k];
 const bags=offer?.baggage.filter(b=>!b.contradictory&&Number.isInteger(b.segment)&&b.segment>=0&&b.segment<offer.segments.length&&Number.isInteger(b.passenger)&&b.passenger>=0&&b.passenger<adults)??[];
 const count=(n:number|null)=>n!==null&&Number.isSafeInteger(n)&&n>=0?n:'—';const kg=(n:number|null)=>n!==null&&Number.isFinite(n)&&n>0?`${n} kg`:'—';
 const facilities=offer?.segments.filter(s=>s.aircraft||s.legroom||s.amenities?.length)??[];
 return <><p className="eyebrow">{t('flightRights')}</p><h3>{t('includedLabel')}</h3>{bags.length?bags.map((b,i)=><p className="rights-bag" key={i}>{t('segmentLabel')} {b.segment+1} · {t('passengerLabel')} {b.passenger+1}<br/>{t('carry')} {count(b.carry_on)} · {kg(b.carry_kg)}<br/>{t('checked')} {count(b.checked)} · {kg(b.checked_kg)}</p>):<p className="muted">{t('bagNotProvided')}</p>}<h3 className="rights-heading">{t('flightAmenities')}</h3>{facilities.length?facilities.map((s,i)=><div className="rights-segment" key={i}><b>{t(s.leg_index===0?'outboundLeg':'returnLeg')} · {s.flight}</b>{s.aircraft&&<p>{t('aircraftLabel')} · {s.aircraft}</p>}{s.legroom&&<p>{t('legroomLabel')} · {s.legroom}</p>}{s.amenities?.map((a,n)=><span className="amenity-chip" key={n}>{a}</span>)}</div>):<p className="muted">{t('amenitiesMissing')}</p>}</>;
}
