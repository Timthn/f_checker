import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {SeparateTravelerQuote,IncludedBags} from '../src/components/traveler-quote';
import {CalendarPanel} from '../src/components/calendar-panel';
import type {Offer,Search} from '../src/domain/contracts';
const q:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',return_date:'2026-11-17',adults:1,cabin:'economy',currency:'HKD',carry_on:1,checked:0};
const offer=(id:string,minor:number):Offer=>({offer_id:id,itinerary_id:'same',comparison_key:null,money:{minor,currency:'HKD',digits:2},segments:[{leg_index:0,from:'HKG',to:'NRT',flight:'GK 28',departure_local:'2026-11-10T01:10:00',arrival_local:'2026-11-10T06:20:00',departure_utc:null,arrival_utc:null,arrival_zone:null,cabin:'economy',duration:250}],baggage:[],complete:true,price_complete:false,quoted_adults:null,duration_minutes:250,fare_identity:null,source:'synthetic',observed_at:new Date().toISOString(),expires_at:new Date(Date.now()+1000).toISOString(),time_verified:false});
it('shows both original amounts, their single sum, requested bags and unavailable inclusion independently',()=>{
 const html=renderToStaticMarkup(createElement(SeparateTravelerQuote,{locale:'en',pair:{a:offer('a',10000),b:offer('b',15000),total:{minor:25000,currency:'HKD',digits:2},nights:7,preferences:[{carry_on:1,checked:0},{carry_on:0,checked:1}]}}));
 for(const s of ['Traveler A','Traveler B','HK$100.00','HK$150.00','HK$250.00','Requested bags','Included in returned quote','Not provided','Sum of independent quotes'])expect(html).toContain(s);
 expect((html.match(/Not provided/g)??[]).length).toBe(2);expect((html.match(/<strong>/g)??[]).length).toBe(1);expect(html).not.toContain('free');
});
it('does not infer baggage inclusion from requested input, incomplete segment coverage or contradictory rows',()=>{
 const o=offer('a',10000);o.baggage=[{segment:0,passenger:0,carry_on:1,checked:null,carry_kg:7,checked_kg:null,source:'synthetic',contradictory:false}];
 expect(renderToStaticMarkup(createElement(IncludedBags,{offer:o,locale:'zh-Hans'}))).toContain('未提供');o.baggage[0].checked=0;o.baggage[0].contradictory=true;expect(renderToStaticMarkup(createElement(IncludedBags,{offer:o,locale:'en'}))).toContain('Not provided');
});
it('calendar server rendering is signed-out, explicit-request only, with fixed-return and coarse-scope labels',()=>{
 const html=renderToStaticMarkup(createElement(QueryClientProvider,{client:new QueryClient()},createElement(CalendarPanel,{query:q,locale:'en',fallbackPoints:[{day:q.departure,minor:10000}]})));
 expect(html).toContain('Fetch nearby date prices');expect(html).toContain('disabled');expect(html).toContain('Fixed return date');expect(html).toContain(q.return_date!);expect(html).toContain('not prices for the selected flight');expect(html).not.toContain('Whole-batch ceiling');
});
