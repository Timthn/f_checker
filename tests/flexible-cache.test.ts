import {expect,it,vi} from 'vitest';
import {flexibleSchema} from '../src/domain/analysis-contracts';
const mocks=vi.hoisted(()=>({transaction:vi.fn(),query:vi.fn()}));
vi.mock('../src/server/db',()=>({transaction:mocks.transaction}));
import {analyzeFlexible} from '../src/server/analysis';

it('scopes both legacy shared-query cache reads to the owner and complete context excluding only travel dates',async()=>{
 const owner='11111111-1111-4111-8111-111111111111';
 const q=flexibleSchema.parse({base:{origin:'HKG',destination:'NRT',departure:'2026-11-10',return_date:'2026-11-17',adults:2,cabin:'economy',currency:'HKD',carry_on:0,checked:0},departure_from:'2026-11-10',departure_to:'2026-11-10',return_from:'2026-11-17',return_to:'2026-11-17',min_nights:1,max_nights:10});
 mocks.query.mockResolvedValue({rows:[]});
 mocks.transaction.mockImplementation(async(_kind,transactionOwner,fn)=>{expect(transactionOwner).toBe(owner);return fn({query:mocks.query});});
 const result=await analyzeFlexible(owner,q);
 expect(mocks.transaction).toHaveBeenCalledTimes(1);
 expect(mocks.transaction.mock.calls[0][0]).toBe('api');
 expect(mocks.query).toHaveBeenCalledTimes(2);
 for(const [sql,params] of mocks.query.mock.calls){
  expect(sql).toContain("(s.query-'departure'-'return_date')=($6::jsonb-'departure'-'return_date')");
  expect(sql).toMatch(/(?:o|s)\.owner_id=\$1/);
  expect(params.slice(0,5)).toEqual([owner,'HKG','NRT','2026-11-10','2026-11-10']);
  expect(JSON.parse(params[5])).toEqual(q.base);
  expect(JSON.parse(params[5])).toMatchObject({adults:2,carry_on:0,checked:0});
 }
 expect(result).toMatchObject({coverage:{planned:1,searched:0,verified:0},paid_requests:0});
});
