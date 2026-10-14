import type {Search} from './contracts';
export type TravelerBaggage={carry_on:number;checked:number};
/** Form context preserves A/B preferences; source batch queries split them below. */
export function flexibleTravelerSearch(base:Search,bags:TravelerBaggage[],adults:1|2):Search{
 const {traveler_baggage:_previous,...shared}=base;
 if(adults===1)return {...shared,adults:1,carry_on:bags[0].carry_on,checked:bags[0].checked};
 return {...shared,adults:2,traveler_baggage:bags.slice(0,2),carry_on:Math.max(...bags.slice(0,2).map(b=>b.carry_on)),checked:Math.max(...bags.slice(0,2).map(b=>b.checked))};
}
export function flexibleSourceQueries(base:Search):{query:Search;participant:'a'|'b'|'dates'}[]{
 const {traveler_baggage,...shared}=base;
 if(!traveler_baggage)return [{query:base,participant:'dates'}];
 return traveler_baggage.map((bags,i)=>({query:{...shared,adults:1,...bags},participant:i===0?'a':'b'}));
}
