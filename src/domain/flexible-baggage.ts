import type {Search} from './contracts';
export type TravelerBaggage={carry_on:number;checked:number};
/** One passenger retains the legacy query; two use explicit conservative uniform filters. */
export function flexibleTravelerSearch(base:Search,bags:TravelerBaggage[],adults:1|2):Search{
 const {traveler_baggage:_previous,...shared}=base;
 if(adults===1)return {...shared,adults:1,carry_on:bags[0].carry_on,checked:bags[0].checked};
 return {...shared,adults:2,traveler_baggage:bags.slice(0,2),carry_on:Math.max(...bags.slice(0,2).map(b=>b.carry_on)),checked:Math.max(...bags.slice(0,2).map(b=>b.checked))};
}
