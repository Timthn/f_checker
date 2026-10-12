import type {Segment} from '@/domain/contracts';
import {airlineLabel,presentLocalTime,localDayChange} from '@/domain/flight-presentation';
import {en,zh,type MessageKey} from '@/i18n/catalog';
export function FlightJourney({segments,locale,individual=false}:{segments:Segment[];locale:'en'|'zh-Hans';individual?:boolean}){
 const t=(k:MessageKey)=>(locale==='en'?en:zh)[k];
 const groups=individual?segments.map(s=>[s]):[0,1].map(i=>segments.filter(s=>s.leg_index===i)).filter(ss=>ss.length);
 return <span className="flight-journey">{groups.map((ss,i)=>{const first=ss[0],last=ss.at(-1)!,start=presentLocalTime(first.departure_local,locale),end=presentLocalTime(last.arrival_local,locale),delta=localDayChange(first.departure_local,last.arrival_local);const airlines=ss.map(s=>airlineLabel(s,locale));return <span className="journey-leg" key={i}>
  <span className="airline-line"><b>{[...new Set(airlines.map(a=>a.name))].join(' / ')}</b><span className="flight-number">{ss.map(s=>s.flight).join(' / ')}</span>{!individual&&groups.length>1&&<span className="leg-label">{t(first.leg_index===0?'outboundLeg':'returnLeg')}</span>}{airlines.some(a=>a.basis==='flight_code')&&<span className="carrier-basis" title={t('carrierFromCode')}>ⓘ</span>}</span>
  <span className="journey-times"><span><b>{start.clock}</b><span>{first.from}</span><small>{start.date}</small></span><span className="journey-route"><span>⟶</span><small>{ss.length===1?t('directFlight'):`${ss.length-1} ${t('connections')}`}</small></span><span><b>{end.clock}</b><span>{last.to}{delta!==null&&delta!==0&&<em className="day-change">{delta>0?'+':''}{delta} {t('dayUnit')}</em>}</span><small>{end.date}</small></span></span>
 </span>;})}</span>;
}
