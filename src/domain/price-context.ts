import type {Offer,Search} from './contracts';
import {departureWindow} from './flight-presentation';
import {referenceEligible} from './reference-recommendations';
import {stableId} from './rules';
export {routeHistoryAverage} from './route-history-average';
export type SavedDateQuote={offer:Offer;query:Search};
export function savedDeparturePrices(rows:SavedDateQuote[],base:Search){
 const days=departureWindow(base.departure),allowed=new Set(days),byDay=new Map<string,{minor:number;observed_at:string}>();
 for(const {offer,query} of rows){
  if(!allowed.has(query.departure)||stableId({...query,departure:base.departure})!==stableId(base))continue;
  const observed=new Date(offer.observed_at);
  // Validate at capture time; this remains a dated saved reference, never a fresh quote guarantee.
  if(!Number.isFinite(observed.getTime())||observed.getTime()>Date.now()||!referenceEligible(offer,query,observed))continue;
  const prior=byDay.get(query.departure);
  if(!prior||observed.getTime()>Date.parse(prior.observed_at)||observed.getTime()===Date.parse(prior.observed_at)&&offer.money.minor<prior.minor)byDay.set(query.departure,{minor:offer.money.minor,observed_at:offer.observed_at});
 }
 return days.map(day=>({day,minor:byDay.get(day)?.minor??null,observed_at:byDay.get(day)?.observed_at??null}));
}
