import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {Search} from '../src/domain/contracts';
import type {RouteHistorySnapshot} from '../src/domain/route-history';
import {summarizePriceWindow,providerPriceSignal,type PriceWindow} from '../src/domain/price-window';

const query:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
const window=(points:PriceWindow['points']):PriceWindow=>({query,currency:'HKD',mode:'trip',points});
describe('visible departure window statistics',()=>{
 it('uses existing positive daily samples within the inclusive selected departure ±15-day window',()=>{
  expect(summarizePriceWindow(window([{day:'2026-10-26',minor:100},{day:'2026-11-10',minor:null},{day:'2026-11-25',minor:300},{day:'2026-10-25',minor:900},{day:'2026-11-26',minor:900}]))).toEqual({count:2,mean:200,median:200});
 });
 it('collapses identical daily quotes and excludes days with conflicting positive prices',()=>{
  expect(summarizePriceWindow(window([{day:'2026-11-01',minor:100},{day:'2026-11-01',minor:100},{day:'2026-11-02',minor:200},{day:'2026-11-02',minor:900},{day:'2026-11-03',minor:400}]))).toEqual({count:2,mean:250,median:250});
 });
 it('computes different mean and median from valid observations without filling gaps',()=>{
  expect(summarizePriceWindow(window([{day:'2026-11-01',minor:100},{day:'2026-11-05',minor:200},{day:'2026-11-20',minor:900}]))).toEqual({count:3,mean:400,median:200});
  expect(summarizePriceWindow(window([{day:'2026-11-01',minor:100},{day:'2026-11-02',minor:201}]))).toEqual({count:2,mean:150.5,median:150.5});
 });
 it('rejects invalid calendar days, malformed currency, and nonpositive or unsafe prices',()=>{
  expect(summarizePriceWindow(window([{day:'2026-11-31',minor:1},{day:'2026-11-1',minor:1},{day:'2026-11-10T00:00:00Z',minor:1},{day:'2026-11-10',minor:0},{day:'2026-11-11',minor:-1},{day:'2026-11-12',minor:NaN},{day:'2026-11-13',minor:Infinity},{day:'2026-11-14',minor:1.5},{day:'2026-11-15',minor:Number.MAX_SAFE_INTEGER+1}]))).toEqual({count:0,mean:null,median:null});
  expect(summarizePriceWindow({...window([{day:'2026-11-10',minor:100}]),currency:'USD'})).toEqual({count:0,mean:null,median:null});
  expect(summarizePriceWindow({...window([{day:'2026-11-10',minor:100}]),currency:'bogus',query:{...query,currency:'bogus'} as unknown as Search})).toEqual({count:0,mean:null,median:null});
  expect(summarizePriceWindow({...window([]),query:{...query,departure:'2026-02-30'}})).toEqual({count:0,mean:null,median:null});
 });
 it('avoids unsafe intermediate sums when calculating large means and medians',()=>{
  expect(summarizePriceWindow(window([{day:'2026-11-01',minor:9007199254740991},{day:'2026-11-02',minor:9007199254740989}]))).toEqual({count:2,mean:9007199254740990,median:9007199254740990});
 });
 it.each([null,undefined])('keeps absent window statistics unknown %s',value=>{expect(summarizePriceWindow(value)).toEqual({count:0,mean:null,median:null});});
});

describe('published provider price signal',()=>{
 beforeEach(()=>{vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-17T00:00:00Z'));});
 afterEach(()=>vi.useRealTimers());
 const history=(price_level:RouteHistorySnapshot['price_level']):RouteHistorySnapshot=>({query_fingerprint:'query',currency:'HKD',digits:2,observed_at:'2026-10-01T00:00:00Z',fetched_at:'2026-10-01T00:00:01Z',source:'apify/build0.0.2',scope:'provider_route_reference',price_scope:'provider_search_quote_unverified_party',date_semantics:'provider_epoch_utc_unverified',points:[],provider_lowest_minor:null,typical_range:null,price_level});
 it.each(['low','typical','high'] as const)('preserves the provider %s tag even with zero observations and an older capture',level=>{expect(providerPriceSignal(history(level))).toBe(level);});
 it('does not invent a signal from prices or missing source tags',()=>{
  expect(providerPriceSignal({...history(null),provider_lowest_minor:100,typical_range:[200,300]})).toBeNull();expect(providerPriceSignal(null)).toBeNull();expect(providerPriceSignal()).toBeNull();
  expect(providerPriceSignal({...history('low'),price_level:'cheap' as 'low'})).toBeNull();
 });
 it.each(['2026-10-17T00:00:01Z','2026-02-30T00:00:00Z','2026-10-01T00:00:00','invalid'])('rejects future or invalid source capture %s',observed_at=>{expect(providerPriceSignal({...history('low'),observed_at})).toBeNull();});
});
