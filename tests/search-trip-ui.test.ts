import {it,expect,vi} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {SearchFlightList} from '../src/components/search-flight-list';
import {SearchPriceTrends} from '../src/components/search-price-trends';
import {planSearch,planReturn} from '../src/connectors/apify-chain';
import {searchPresentation} from '../src/domain/search-presentation';
import type {Search} from '../src/domain/contracts';
import round from '../docs/connectors/fixtures/apify-build-0.0.2/round-trip-search.json';
import back from '../docs/connectors/fixtures/apify-build-0.0.2/return-options.json';
const q:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',return_date:'2026-11-17',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
function pair(){const raw=structuredClone(round.provider_response),a=planSearch({...raw,itineraries:raw.itineraries.map((i,n)=>({...i,departure_token:`fixture-${n}`}))},q);return searchPresentation(planReturn(back.provider_response,q,a.next!.selected).offers,q).hero!;}
it('renders one whole-pair option with both flight numbers/dates/clocks and one total',()=>{const o=pair(),html=renderToStaticMarkup(createElement(SearchFlightList,{offers:[o],leg:'both',locale:'en',onSelect:()=>{}}));for(const s of o.segments){expect(html).toContain(s.flight);expect(html).toContain(s.departure_local.slice(11,16));expect(html).toContain(s.arrival_local.slice(11,16));}for(const text of ['Round-trip combinations','Outbound','Return','Nov 10','Nov 17'])expect(html).toContain(text);expect((html.match(/fare-result/g)??[]).length).toBe(1);expect((html.match(/<strong>/g)??[]).length).toBe(1);});
it('single flights show no return header or graph switch',()=>{const o=pair(),one={...q,return_date:undefined};const list=renderToStaticMarkup(createElement(SearchFlightList,{offers:[{...o,segments:o.segments.filter(s=>s.leg_index===0)}],leg:0,locale:'en',onSelect:()=>{}}));expect(list).toContain('Outbound flights');expect(list).not.toContain('Round-trip combinations');const html=renderToStaticMarkup(createElement(QueryClientProvider,{client:new QueryClient()},createElement(SearchPriceTrends,{query:one,offer:o,locale:'en'})));expect(html).not.toContain('Return trend');expect(html).toContain('±15 days');});
it('round-trip graph labels the leg and switch; mount does not dispatch paid queries',()=>{const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);try{const o=pair(),html=renderToStaticMarkup(createElement(QueryClientProvider,{client:new QueryClient()},createElement(SearchPriceTrends,{query:q,offer:o,locale:'zh-Hans'})));expect(html).toContain('查看去程走势');expect(html).toContain('2026-11-10');expect(html).not.toContain('不是往返总价拆分');expect(html).toContain('此往返航线的过去报价记录');expect(fetcher).not.toHaveBeenCalled();}finally{vi.unstubAllGlobals();}});
