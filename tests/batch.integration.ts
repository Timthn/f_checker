import {beforeAll,afterAll,afterEach,it,expect,vi} from 'vitest';
import {Client} from 'pg';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {admitBatch,cancelBatch,getBatch} from '../src/server/batches';
import {claimJob,reserveCall,beginDispatch,createJob,cancelJob,failJob} from '../src/server/jobs';
import {recordOffer} from '../src/server/offer-recording';
import {readBatchResults} from '../src/server/batch-results';
import {parseSearch} from '../src/connectors/apify-adapter';
import {ensureBatchWorkflow,prepareBatch,recoverStoppedChild,reconcileCompletedBatch} from '../src/server/batch-execution';
import type {Offer} from '../src/domain/contracts';
import {transaction,pool} from '../src/server/db';
import {stableId} from '../src/domain/rules';
import {liveFlexibleSchema} from '../src/domain/batch-contracts';
process.loadEnvFile('.env');process.loadEnvFile('.env.migration');
const url=new URL(process.env.MIGRATION_DATABASE_URL!);
if(url.hostname!=='aws-0-ap-southeast-1.pooler.supabase.com'||decodeURIComponent(url.username)!=='postgres.fpxnoiwaytkplrfsymyp')throw Error('PROJECT_BOUNDARY');
const admin=new Client({connectionString:process.env.MIGRATION_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:readFileSync('config/supabase-ca.crt','utf8')},connectionTimeoutMillis:10000});
const owner=randomUUID(),other=randomUUID();let baseline:string;
const base={origin:'HKG',destination:'NRT',departure:'2026-11-10',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
const meeting={a:base,b:{...base,origin:'SIN'},arrival_day:'2026-11-10',max_minutes:60,departure_scope:'fixed_departures',max_budget_microusd:200000};
const flexible={base,departure_from:'2026-11-10',departure_to:'2026-11-11',return_from:'2026-11-17',return_to:'2026-11-17',min_nights:7,max_nights:8,max_budget_microusd:200000};
const lifetime=async()=>String((await admin.query("select reserved_microusd from flight.budget_accounts where account_key='spike-lifetime'")).rows[0].reserved_microusd);
it('read reconciliation closes completed members after expiry without restarting or changing child evidence',async()=>{
 const batch=await admitBatch(owner,'meeting',meeting,randomUUID());
 await admin.query("update flight.jobs j set status='partial' from flight.batch_items i where i.owner_id=j.owner_id and i.child_job_id=j.job_id and i.owner_id=$1 and i.batch_id=$2",[owner,batch.batch_id]);
 await admin.query("update flight.batches set status='running',expires_at=now()-interval '1 second' where owner_id=$1 and batch_id=$2",[owner,batch.batch_id]);
 expect(await reconcileCompletedBatch(other,batch.batch_id)).toBe(false);
 expect(await reconcileCompletedBatch(owner,batch.batch_id)).toBe(true);
 const state=await getBatch(owner,batch.batch_id);expect(state?.status).toBe('partial');expect(state?.items.every((i:{status:string})=>i.status==='partial')).toBe(true);
 expect(await reconcileCompletedBatch(owner,batch.batch_id)).toBe(false);expect(await lifetime()).toBe(baseline);
});
it('read reconciliation leaves pending children and their reserved budget untouched',async()=>{
 const batch=await admitBatch(owner,'meeting',meeting,randomUUID()),before=await lifetime();
 expect(await reconcileCompletedBatch(owner,batch.batch_id)).toBe(false);expect((await getBatch(owner,batch.batch_id))?.status).toBe('queued');expect(await lifetime()).toBe(before);
});
it('parent completion takes precedence over expiry when all children already finished',async()=>{
 const batch=await admitBatch(owner,'meeting',meeting,randomUUID());const execution=await ensureBatchWorkflow(owner,batch.batch_id,async()=>`qa-final-${batch.batch_id}`);
 await admin.query("update flight.jobs j set status='partial' from flight.batch_items i where i.owner_id=j.owner_id and i.child_job_id=j.job_id and i.owner_id=$1 and i.batch_id=$2",[owner,batch.batch_id]);
 await admin.query("update flight.batches set expires_at=now()-interval '1 second' where owner_id=$1 and batch_id=$2",[owner,batch.batch_id]);
 expect((await prepareBatch(batch.batch_id,execution!)).done).toBe(true);expect((await getBatch(owner,batch.batch_id))?.status).toBe('partial');
});
beforeAll(async()=>{await admin.connect();await admin.query("insert into auth.users(id,email,aud,role) values($1,$2,'authenticated','authenticated'),($3,$4,'authenticated','authenticated')",[owner,`qa-${owner}@example.invalid`,other,`qa-${other}@example.invalid`]);baseline=await lifetime();});
async function cleanupBatches(){
 const batches=(await admin.query('select batch_id,accounting_period from flight.batches where owner_id=$1',[owner])).rows;
 for(const b of batches)await cancelBatch(owner,b.batch_id);
 const calls=(await admin.query('select p.phase,p.run_id,p.reads_reserved,p.ceiling_microusd,b.accounting_period from flight.provider_calls p join flight.batch_items i on i.owner_id=p.owner_id and i.child_job_id=p.job_id join flight.batches b on b.owner_id=i.owner_id and b.batch_id=i.batch_id where p.owner_id=$1',[owner])).rows;
 // This suite executes no provider HTTP. Only proven reserved/no-ID/no-read QA calls
 // may be refunded; ambiguous or dispatched records block cleanup and stay preserved.
 if(calls.some(c=>c.phase!=='reserved'||c.run_id!==null||c.reads_reserved!==0))throw Error('SYNTHETIC_REFUND_NOT_PROVEN');
 await admin.query('begin');try{
  for(const p of new Set(calls.map(c=>c.accounting_period))){const group=calls.filter(c=>c.accounting_period===p),amount=group.reduce((n,c)=>n+BigInt(c.ceiling_microusd),0n),keys=['spike-lifetime',`month:${p}`,`owner:${owner}:${p}`].sort();await admin.query('select account_key from flight.budget_accounts where account_key=any($1::text[]) order by account_key for update',[keys]);await admin.query('update flight.budget_accounts set reserved_microusd=reserved_microusd-$2,calls_reserved=calls_reserved-$3 where account_key=any($1::text[])',[keys,amount.toString(),group.length]);}
  await admin.query('delete from flight.batch_slots where owner_id=$1',[owner]);await admin.query('delete from flight.batch_items where owner_id=$1',[owner]);await admin.query('delete from flight.batches where owner_id=$1',[owner]);
  for(const t of ['observations','calendar_cells','offers','provider_references','checkpoints','provider_calls','jobs','searches'])await admin.query(`delete from flight.${t} where owner_id=$1`,[owner]);
  await admin.query('commit');
 }catch(e){await admin.query('rollback');throw e;}
 expect(await lifetime()).toBe(baseline);
}
afterEach(async()=>{vi.restoreAllMocks();await cleanupBatches();});
afterAll(async()=>{try{await cleanupBatches();await admin.query('delete from flight.budget_accounts where account_key like $1',[`owner:${owner}:%`]);await admin.query('delete from auth.users where id=any($1::uuid[])',[[owner,other]]);}finally{await admin.end();await Promise.all([pool('api').end(),pool('worker').end()]);}});

it('heuristic admission uses owned fresh seed neighbors and freezes replay before seed changes',async()=>{
 const input={...flexible,departure_to:'2026-11-12',return_to:'2026-11-19',strategy:'heuristic',max_pairs:1};
 const first=await admitBatch(owner,'flexible',input,randomUUID()),member=(await getBatch(owner,first.batch_id))!.items[0],query=member.query;
 expect(query.departure).toBe('2026-11-11');expect(query.return_date).toBe('2026-11-18');
 const id=randomUUID(),at=new Date().toISOString(),expiry=new Date(Date.now()+900000).toISOString();
 const segment=(from:string,to:string,day:string,leg_index:number)=>({leg_index,from,to,departure_local:day+'T09:00:00',arrival_local:day+'T14:00:00',departure_utc:null,arrival_utc:null,arrival_zone:null,flight:'QA',cabin:'economy',duration:300});
 const payload={offer_id:id,itinerary_id:id,comparison_key:null,money:{minor:10000,currency:'HKD',digits:2},complete:true,price_complete:false,quoted_adults:null,time_verified:false,source:'synthetic_test',fare_identity:null,observed_at:at,expires_at:expiry,duration_minutes:600,baggage:[],quote_evidence:{state:'source_fields_matched',display_minor:10000,exact_minor:10000},segments:[segment('HKG','NRT',query.departure,0),segment('NRT','HKG',query.return_date,1)]};
 await admin.query('insert into flight.offers(owner_id,offer_id,job_id,itinerary_id,provider_result_key,observed_at,expires_at,payload) values($1,$2,$3,$4,$5,$6,$7,$8)',[owner,id,member.child_job_id,id,'qa-seed:0',at,expiry,payload]);
 await cancelBatch(owner,first.batch_id);expect(await lifetime()).toBe(baseline);
 const key=randomUUID(),second=await admitBatch(owner,'flexible',input,key),before=await getBatch(owner,second.batch_id);
 expect(before!.plan.coverage.selection_basis).toBe('saved_quote_neighbors');expect(before!.items[0].query.departure).toBe('2026-11-10');expect(before!.items[0].query.return_date).toBe('2026-11-18');
 expect(BigInt(await lifetime())-BigInt(baseline)).toBe(60000n);
 await admin.query('update flight.offers set expires_at=now()-interval \'1 second\',payload=jsonb_set(payload,\'{expires_at}\',to_jsonb((now()-interval \'1 second\')::text)) where owner_id=$1 and offer_id=$2',[owner,id]);
 expect((await admitBatch(owner,'flexible',input,key)).batch_id).toBe(second.batch_id);expect((await getBatch(owner,second.batch_id))!.plan).toEqual(before!.plan);
 expect(await readBatchResults(other,second.batch_id)).toBeNull();
});

it('legacy batch retry preserves pre-strategy idempotency without allowing a new strategy',async()=>{
 const input={...flexible,departure_to:flexible.departure_from},key=randomUUID(),first=await admitBatch(owner,'flexible',input,key);
 const {strategy:_s,max_pairs:_m,...legacy}=liveFlexibleSchema.parse(input);
 await admin.query('update flight.batches set request=$3,request_hash=$4 where owner_id=$1 and batch_id=$2',[owner,first.batch_id,legacy,stableId({kind:'flexible',request:legacy})]);
 expect((await admitBatch(owner,'flexible',input,key)).batch_id).toBe(first.batch_id);
 await expect(admitBatch(owner,'flexible',{...input,strategy:'heuristic',max_pairs:1},key)).rejects.toThrow('IDEMPOTENCY_CONFLICT');
 expect(BigInt(await lifetime())-BigInt(baseline)).toBe(60000n);
});

it('whole admission is atomic, owner-scoped and idempotent before any provider IO',async()=>{
 const key=randomUUID(),batch=await admitBatch(owner,'meeting',meeting,key),again=await admitBatch(owner,'meeting',meeting,key);
 expect(again.batch_id).toBe(batch.batch_id);expect(again.reused).toBe(true);expect(BigInt(await lifetime())-BigInt(baseline)).toBe(60000n);
 expect((await getBatch(owner,batch.batch_id))?.items).toHaveLength(2);expect(await getBatch(other,batch.batch_id)).toBeNull();
 await expect(transaction('api',owner,c=>c.query('select * from flight.batch_slots'))).rejects.toMatchObject({code:'42501'});
 await expect(admitBatch(owner,'meeting',{...meeting,max_minutes:30},key)).rejects.toThrow('IDEMPOTENCY_CONFLICT');
 await cancelBatch(owner,batch.batch_id);await cancelBatch(owner,batch.batch_id);expect(await lifetime()).toBe(baseline);
});
it('reads only this batch members through the restricted API role',async()=>{
 const batch=await admitBatch(owner,'flexible',flexible,randomUUID());
 const result=await readBatchResults(owner,batch.batch_id);expect(result).toMatchObject({kind:'flexible',source:'batch_members_only',paid_requests:0,coverage:{admitted:2,searched:0,verified_cells:0},result_coverage:{omitted_offers:0}});
 expect(result?.kind==='flexible'?result.cells.map(c=>c.query_status):null).toEqual(['queued','queued']);
 const member=(await getBatch(owner,batch.batch_id))!.items[0],at=new Date().toISOString();
 const raw=JSON.parse(readFileSync('docs/connectors/fixtures/apify-build-0.0.2/round-trip-search.json','utf8')).provider_response;
 const sample=parseSearch(raw,member.query)[0];
 for(const [index,id] of [[0,'00000000-0000-4000-8000-000000000999'],[1,'00000000-0000-4000-8000-000000000111'],[10,'00000000-0000-4000-8000-000000000222']] as const){
  const value={...sample,offer_id:id,itinerary_id:`qa-order-${index}`,observed_at:at,expires_at:new Date(Date.now()+900000).toISOString()};
  await admin.query('insert into flight.offers(owner_id,offer_id,job_id,itinerary_id,provider_result_key,observed_at,expires_at,payload) values($1,$2,$3,$4,$5,$6,$7,$8)',[owner,id,member.child_job_id,value.itinerary_id,`00000000-0000-4000-8000-000000000777:${index}`,at,value.expires_at,value]);
 }
 const candidates=await readBatchResults(owner,batch.batch_id);expect(candidates?.source_candidates[0].offers.map(o=>o.itinerary_id)).toEqual(['qa-order-0','qa-order-1','qa-order-10']);
 expect(candidates?.kind==='flexible'?candidates.recommendations:undefined).toEqual([]);
 expect(await readBatchResults(other,batch.batch_id)).toBeNull();expect(await readBatchResults(owner,randomUUID())).toBeNull();
 expect(BigInt(await lifetime())-BigInt(baseline)).toBe(120000n);
});
it('parent startup replay, execution fence, child capacity and terminal refund are durable',async()=>{
 const batch=await admitBatch(owner,'flexible',flexible,randomUUID()),launcher=vi.fn(async()=>`qa-parent-${batch.batch_id}`);
 const first=await ensureBatchWorkflow(owner,batch.batch_id,launcher);expect(await ensureBatchWorkflow(owner,batch.batch_id,launcher)).toBe(first);expect(launcher).toHaveBeenCalledTimes(1);
 expect(await ensureBatchWorkflow(owner,batch.batch_id,launcher,async()=>false)).toBe(first);expect(launcher).toHaveBeenCalledTimes(1);
 await expect(ensureBatchWorkflow(owner,batch.batch_id,launcher,async()=>{throw Error('QA observation timeout');})).rejects.toThrow('QA observation timeout');expect(launcher).toHaveBeenCalledTimes(1);
 expect((await prepareBatch(batch.batch_id,'qa-other-execution')).done).toBe(true);
 const work=await prepareBatch(batch.batch_id,first!);expect(work.children).toHaveLength(2);expect(work.owner).toBe(owner);
 await admin.query("update flight.jobs j set workflow_id='qa-child-active' from flight.batch_items i where i.owner_id=j.owner_id and i.child_job_id=j.job_id and i.owner_id=$1 and i.batch_id=$2 and i.ordinal=0",[owner,batch.batch_id]);
 expect((await prepareBatch(batch.batch_id,first!)).children).toHaveLength(1);
 await admin.query("update flight.jobs j set status='failed' from flight.batch_items i where i.owner_id=j.owner_id and i.child_job_id=j.job_id and i.owner_id=$1 and i.batch_id=$2",[owner,batch.batch_id]);
 expect((await prepareBatch(batch.batch_id,first!)).done).toBe(true);expect((await getBatch(owner,batch.batch_id))?.status).toBe('failed');expect(await lifetime()).toBe(baseline);
 await prepareBatch(batch.batch_id,first!);expect(await lifetime()).toBe(baseline);
});
it('parent start failure retries the same batch; expiry cancels children and refunds undispatched holds',async()=>{
 const batch=await admitBatch(owner,'meeting',meeting,randomUUID());
 await expect(ensureBatchWorkflow(owner,batch.batch_id,async()=>{throw Error('QA SDK failure');})).rejects.toThrow('WORKFLOW_START_RETRY');
 const id=await ensureBatchWorkflow(owner,batch.batch_id,async()=>`qa-recovered-${batch.batch_id}`);
 await admin.query("update flight.batches set expires_at=now()-interval '1 second' where owner_id=$1 and batch_id=$2",[owner,batch.batch_id]);
 expect((await prepareBatch(batch.batch_id,id!)).done).toBe(true);const state=await getBatch(owner,batch.batch_id);expect(state?.status).toBe('uncertain');expect(state?.items.every((i:{status:string})=>i.status==='cancelled')).toBe(true);expect(await lifetime()).toBe(baseline);
});
it('replaces only an authoritatively stopped parent while preserving admitted children and budget',async()=>{
 const batch=await admitBatch(owner,'meeting',meeting,randomUUID()),before=(await getBatch(owner,batch.batch_id))!.items.map((i:{child_job_id:string})=>i.child_job_id);
 const first=await ensureBatchWorkflow(owner,batch.batch_id,async()=>`qa-first-${batch.batch_id}`);await prepareBatch(batch.batch_id,first!);
 const second=await ensureBatchWorkflow(owner,batch.batch_id,async()=>`qa-second-${batch.batch_id}`,async()=>true);expect(second).not.toBe(first);
 expect((await prepareBatch(batch.batch_id,first!)).done).toBe(true);expect((await prepareBatch(batch.batch_id,second!)).children).toEqual(before);
 expect((await getBatch(owner,batch.batch_id))!.items.map((i:{child_job_id:string})=>i.child_job_id)).toEqual(before);expect(BigInt(await lifetime())-BigInt(baseline)).toBe(60000n);
});
it('restarts a stopped child only before any provider dispatch',async()=>{
 const batch=await admitBatch(owner,'meeting',meeting,randomUUID()),item=(await getBatch(owner,batch.batch_id))!.items[0];
 await admin.query("update flight.jobs set workflow_id='qa-stopped-child' where owner_id=$1 and job_id=$2",[owner,item.child_job_id]);
 const job=await claimJob(item.child_job_id,'qa-stopped-child'),call=await reserveCall(job!,'search');
 expect(await recoverStoppedChild(owner,item.child_job_id,'qa-wrong')).toBe(false);
 expect(await recoverStoppedChild(owner,item.child_job_id,'qa-stopped-child')).toBe(true);
 await failJob(job!,'QA_STALE_CALLBACK',false);expect((await getBatch(owner,batch.batch_id))!.items[0].status).toBe('queued');
 const restarted=await claimJob(item.child_job_id,'qa-restarted-child');expect(restarted?.lease_version).not.toBe(job?.lease_version);
 const adopted=await reserveCall(restarted!,'search');expect(adopted.call_id).toBe(call.call_id);expect(adopted.lease_version).toBe(restarted?.lease_version);expect(BigInt(await lifetime())-BigInt(baseline)).toBe(60000n);
 // Fake ambiguous state only: no HTTP. Restore reserved after proving conservative behavior,
 // allowing the suite's no-I/O-only refund guard to clean temporary QA rows.
 await admin.query("update flight.provider_calls set phase='dispatching' where owner_id=$1 and call_id=$2",[owner,call.call_id]);
 try{expect(await recoverStoppedChild(owner,item.child_job_id,'qa-restarted-child')).toBe(false);expect((await getBatch(owner,batch.batch_id))!.items[0].status).toBe('uncertain');}
 finally{await admin.query("update flight.provider_calls set phase='reserved' where owner_id=$1 and call_id=$2 and run_id is null and reads_reserved=0",[owner,call.call_id]);}
});
it('competing complete plans cannot partially overspend the shared lifetime cap',async()=>{
 const outcomes=await Promise.allSettled([admitBatch(owner,'flexible',flexible,randomUUID()),admitBatch(owner,'flexible',flexible,randomUUID())]);
 expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(outcomes.filter(r=>r.status==='rejected')).toHaveLength(1);expect(BigInt(await lifetime())-BigInt(baseline)).toBe(120000n);
 expect((await admin.query('select count(*)::int as n from flight.batches where owner_id=$1',[owner])).rows[0].n).toBe(1);
});
it('transfers a held slot once without charging budget accounts again',async()=>{
 const batch=await admitBatch(owner,'meeting',meeting,randomUUID()),items=(await getBatch(owner,batch.batch_id))!.items;
 const job=await claimJob(items[0].child_job_id);expect(job).toBeTruthy();const call=await reserveCall(job!,'search'),again=await reserveCall(job!,'search');
 expect(call.batch_prepaid).toBe(true);expect(again.call_id).toBe(call.call_id);expect(again.reused).toBe(true);expect(BigInt(await lifetime())-BigInt(baseline)).toBe(60000n);
 await cancelBatch(owner,batch.batch_id);expect(BigInt(await lifetime())-BigInt(baseline)).toBe(30000n);expect(await beginDispatch(job!,call.call_id)).toBe(false);
});
it('rechecks hold expiry at the actual pre-IO dispatch boundary',async()=>{
 const batch=await admitBatch(owner,'meeting',meeting,randomUUID()),item=(await getBatch(owner,batch.batch_id))!.items[0],job=await claimJob(item.child_job_id),call=await reserveCall(job!,'search');
 await admin.query("update flight.batches set expires_at=now()-interval '1 second' where owner_id=$1 and batch_id=$2",[owner,batch.batch_id]);
 await expect(beginDispatch(job!,call.call_id)).rejects.toThrow('BATCH_BUDGET_PERIOD_EXPIRED');
 expect((await admin.query('select phase from flight.provider_calls where owner_id=$1 and call_id=$2',[owner,call.call_id])).rows[0].phase).toBe('reserved');
});
it('rechecks month rollover without consuming a new-month account silently',async()=>{
 const batch=await admitBatch(owner,'meeting',meeting,randomUUID()),item=(await getBatch(owner,batch.batch_id))!.items[0],job=await claimJob(item.child_job_id),call=await reserveCall(job!,'search');
 const month=new Date().toISOString().slice(0,7)==='2099-01'?'2099-02':'2099-01';vi.spyOn(Date.prototype,'toISOString').mockReturnValue(`${month}-01T00:00:00.000Z`);
 await expect(beginDispatch(job!,call.call_id)).rejects.toThrow('BATCH_BUDGET_PERIOD_EXPIRED');vi.restoreAllMocks();
});
it('an identical locked-side request resumes its batch even after the offer expires',async()=>{
 const job=await createJob(owner,base as never,randomUUID()),id=randomUUID(),now=new Date();
 const payload={offer_id:id,itinerary_id:'qa-locked-itinerary',comparison_key:null,money:{minor:90000,currency:'HKD',digits:2},segments:[{leg_index:0,from:'HKG',to:'NRT',departure_local:'2026-11-10T14:00:00',arrival_local:'2026-11-10T19:00:00',departure_utc:'2026-11-10T06:00:00Z',arrival_utc:'2026-11-10T10:00:00Z',arrival_zone:'Asia/Tokyo',flight:'QA SYNTHETIC LOCK',cabin:'economy',duration:240}],baggage:[{segment:0,passenger:0,carry_on:0,checked:0,carry_kg:null,checked_kg:null,source:'synthetic_qa_only',contradictory:false}],complete:true,price_complete:true,quoted_adults:1,duration_minutes:240,fare_identity:'synthetic_qa_only',source:'synthetic_qa_only',observed_at:now.toISOString(),expires_at:new Date(now.getTime()+900000).toISOString(),time_verified:true};
 await admin.query('insert into flight.offers(owner_id,offer_id,job_id,itinerary_id,comparison_key,provider_result_key,observed_at,expires_at,payload) values($1,$2,$3,$4,null,$5,$6,$7,$8)',[owner,id,job.job_id,payload.itinerary_id,'qa-lock',payload.observed_at,payload.expires_at,payload]);
 const input={...meeting,departure_scope:'arrival_window',lock_a:id},key=randomUUID(),batch=await admitBatch(owner,'meeting',input,key);
 await admin.query("update flight.offers set payload=jsonb_set(payload,'{expires_at}',to_jsonb((now()-interval '1 minute')::text)) where owner_id=$1 and offer_id=$2",[owner,id]);
 expect((await admitBatch(owner,'meeting',input,key)).batch_id).toBe(batch.batch_id);await expect(admitBatch(owner,'meeting',input,randomUUID())).rejects.toThrow('LOCK_UNAVAILABLE');
});
it('direct child cancellation prevents dispatch without requiring parent cancellation',async()=>{
 const batch=await admitBatch(owner,'meeting',meeting,randomUUID()),item=(await getBatch(owner,batch.batch_id))!.items[0],job=await claimJob(item.child_job_id),call=await reserveCall(job!,'search');
 await cancelJob(owner,item.child_job_id);expect(await beginDispatch(job!,call.call_id)).toBe(false);
 expect((await admin.query('select phase from flight.provider_calls where owner_id=$1 and call_id=$2',[owner,call.call_id])).rows[0].phase).toBe('reserved');
});
it('persists eligible fixture observations once with owner scope and strips private attachments',async()=>{
 // Simulated fully evidenced provider quote, temporary QA owner: not a live observation.
 const job=await createJob(owner,base as never,randomUUID()),now=new Date(),o:Offer={offer_id:randomUUID(),itinerary_id:'qa-comparable-itinerary',comparison_key:`qa-comparison:${owner}`,money:{minor:90000,currency:'HKD',digits:2},segments:[{leg_index:0,from:'HKG',to:'NRT',departure_local:'2026-11-10T14:00:00',arrival_local:'2026-11-10T19:00:00',departure_utc:'2026-11-10T06:00:00Z',arrival_utc:'2026-11-10T10:00:00Z',arrival_zone:'Asia/Tokyo',flight:'QA SIMULATED PROVIDER',cabin:'economy',duration:240}],baggage:[{segment:0,passenger:0,carry_on:0,checked:0,carry_kg:null,checked_kg:null,source:'apify/build0.0.2/booking',contradictory:false}],complete:true,price_complete:true,quoted_adults:1,duration_minutes:240,fare_identity:'qa-simulated-rights',source:'apify/build0.0.2/booking',observed_at:now.toISOString(),expires_at:new Date(now.getTime()+900000).toISOString(),time_verified:true};
 const write=(value:Offer,key:string)=>transaction('worker',null,async c=>{await c.query('select job_id from flight.jobs where owner_id=$1 and job_id=$2 for update',[owner,job.job_id]);return recordOffer(c,owner,job.job_id,key,value,base as never);});
 expect(await write(Object.assign(o,{booking_token:'QA_PRIVATE_NOT_REPLAYABLE',booking_payload:{private:true}}),'qa-observation')).toEqual({inserted:true,sampled:true});
 expect(await write({...o,offer_id:randomUUID()},'qa-observation')).toEqual({inserted:false,sampled:false});
 expect(await write({...o,offer_id:randomUUID(),source:'synthetic_qa_only'},'qa-ineligible')).toEqual({inserted:true,sampled:false});
 const observations=await transaction('api',owner,c=>c.query('select comparison_key,amount_minor from flight.observations where owner_id=$1',[owner]));expect(observations.rows).toHaveLength(1);expect(observations.rows[0].amount_minor).toBe('90000');
 expect((await transaction('api',other,c=>c.query('select * from flight.observations where owner_id=$1',[owner]))).rows).toHaveLength(0);
 const stored=(await admin.query('select payload from flight.offers where owner_id=$1 and offer_id=$2',[owner,o.offer_id])).rows[0].payload;expect(stored.booking_token).toBeUndefined();expect(stored.booking_payload).toBeUndefined();
});
