import { beforeAll,afterAll,it,expect,vi } from 'vitest';
import { Client } from 'pg';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createJob,readJob,cancelJob,claimJob,reserveCall,beginDispatch,ensureWorkflow,suspendJob,finalizeCancellation,saveRun,completeCall } from '../src/server/jobs';
import { transaction,pool } from '../src/server/db';
import { reserveRead,reconcileKnownRun } from '../src/server/provider-reads';
import economy from '../docs/connectors/fixtures/apify-build-0.0.2/economy-one-way.json';
import { parseSearch } from '../src/connectors/apify-adapter';
import { completeStage,privateContinuation,purgeReferences } from '../src/server/provider-chain';
const provider=vi.hoisted(()=>({status:vi.fn().mockResolvedValue({status:'SUCCEEDED',usage:0})}));
vi.mock('../src/connectors/apify-rest',()=>({runStatus:provider.status}));
process.loadEnvFile('.env');process.loadEnvFile('.env.migration');
const admin=new Client({connectionString:process.env.MIGRATION_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:readFileSync('config/supabase-ca.crt','utf8')}});
const owner=randomUUID(),other=randomUUID(),period=new Date().toISOString().slice(0,7);
const query={origin:'HKG',destination:'NRT',departure:'2026-11-10',adults:1,cabin:'economy' as const,currency:'HKD' as const,carry_on:0,checked:0};
let initial:string;
beforeAll(async()=>{await admin.connect();await admin.query("insert into auth.users(id,email,aud,role) values($1,$2,'authenticated','authenticated'),($3,$4,'authenticated','authenticated')",[owner,`qa-${owner}@example.invalid`,other,`qa-${other}@example.invalid`]);initial=(await admin.query("select reserved_microusd from flight.budget_accounts where account_key='spike-lifetime'")).rows[0].reserved_microusd;});
afterAll(async()=>{
 // Only test reservations still in reserved state are refundable: this test makes ZERO HTTP/provider calls.
 const calls=(await admin.query('select phase,ceiling_microusd from flight.provider_calls where owner_id=$1',[owner])).rows;
 if(calls.some(c=>c.phase!=='reserved'))throw Error('TEST_RESERVATION_UNCERTAIN_KEEP_LEDGER');
 const amount=calls.reduce((n,c)=>n+BigInt(c.ceiling_microusd),0n);
 await admin.query('begin');
 await admin.query('update flight.budget_accounts set reserved_microusd=reserved_microusd-$2,calls_reserved=calls_reserved-$3 where account_key=any($1::text[])',[[ 'spike-lifetime',`month:${period}`,`owner:${owner}:${period}` ],amount.toString(),calls.length]);
 await admin.query('delete from flight.provider_calls where owner_id=$1',[owner]);await admin.query('delete from flight.jobs where owner_id=any($1::uuid[])',[[owner,other]]);await admin.query('delete from flight.searches where owner_id=any($1::uuid[])',[[owner,other]]);await admin.query('delete from flight.budget_accounts where account_key=$1',[`owner:${owner}:${period}`]);await admin.query('delete from auth.users where id=any($1::uuid[])',[[owner,other]]);await admin.query('commit');
 expect((await admin.query("select reserved_microusd from flight.budget_accounts where account_key='spike-lifetime'")).rows[0].reserved_microusd).toBe(initial);
 await admin.end();await Promise.all([pool('api').end(),pool('worker').end()]);
});
it('concurrent identical submissions reuse one owned job and reject conflicting payload',async()=>{const key=randomUUID();const [a,b]=await Promise.all([createJob(owner,query,key),createJob(owner,query,key)]);expect(a.job_id).toBe(b.job_id);expect(await readJob(other,a.job_id)).toBeNull();await expect(createJob(owner,{...query,destination:'SIN'},key)).rejects.toThrow('IDEMPOTENCY_CONFLICT');});
it('cancellation survives a new read and prevents dispatch',async()=>{const job=await createJob(owner,query,randomUUID());expect(await cancelJob(other,job.job_id)).toBeNull();await cancelJob(owner,job.job_id);expect((await readJob(owner,job.job_id)).cancelled_at).toBeTruthy();expect(await claimJob(job.job_id)).toBeNull();});
it('SDK start failure preserves the original job; retry and concurrent delivery start once',async()=>{
 const key=randomUUID(),j=await createJob(owner,query,key);let attempts=0;
 await expect(ensureWorkflow(owner,j.job_id,async()=>{attempts++;throw Error('SDK_OFFLINE');})).rejects.toThrow('WORKFLOW_START_RETRY');
 expect((await createJob(owner,query,key)).job_id).toBe(j.job_id);
 const ids=await Promise.all([ensureWorkflow(owner,j.job_id,async()=>{attempts++;await transaction('worker',null,async c=>{await c.query('select job_id from flight.jobs where job_id=$1 for update',[j.job_id]);});return 'qa-safe-workflow';}),ensureWorkflow(owner,j.job_id,async()=>{attempts++;return 'qa-duplicate';})]);
 expect(attempts).toBe(2);expect(ids).toContain('qa-safe-workflow');expect(ids.every(id=>id===null||id==='qa-safe-workflow')).toBe(true);expect(await ensureWorkflow(owner,j.job_id,async()=>{throw Error('MUST_NOT_START');})).toBe('qa-safe-workflow');
});
it('third job waits for capacity; exhausted queue can resume without changing job ID',async()=>{
 const ids=await Promise.all([1,2,3].map(()=>createJob(owner,query,randomUUID())));
 expect(await claimJob(ids[0].job_id)).toBeTruthy();expect(await claimJob(ids[1].job_id)).toBeTruthy();expect(await claimJob(ids[2].job_id)).toBeNull();
 await suspendJob(ids[2].job_id,true);expect((await readJob(owner,ids[2].job_id)).status).toBe('queued');
 await cancelJob(owner,ids[0].job_id);await finalizeCancellation(ids[0].job_id);expect(await claimJob(ids[2].job_id)).toBeTruthy();
 await cancelJob(owner,ids[1].job_id);await cancelJob(owner,ids[2].job_id);await finalizeCancellation(ids[1].job_id);await finalizeCancellation(ids[2].job_id);
});
it('expired leases and cancelled jobs do not free unresolved upstream run capacity',async()=>{
 const ids=await Promise.all([1,2,3].map(()=>createJob(owner,query,randomUUID()))),calls=[randomUUID(),randomUUID()];
 // Synthetic DB records only: these IDs have never been sent to a provider; no reservation/refund.
 try{
  for(let i=0;i<2;i++)await admin.query("insert into flight.provider_calls(owner_id,job_id,call_id,operation_key,phase,ceiling_microusd,lease_version,run_id) values($1,$2,$3,'qa-offline-capacity',$4,1,0,'QA_SYNTHETIC_NEVER_DISPATCHED')",[owner,ids[i].job_id,calls[i],i?'uncertain':'running']);
  await cancelJob(owner,ids[0].job_id);await finalizeCancellation(ids[0].job_id);
  expect(await claimJob(ids[2].job_id)).toBeNull();
 }finally{await admin.query('delete from flight.provider_calls where owner_id=$1 and call_id=any($2::uuid[])',[owner,calls]);}
 expect(await claimJob(ids[2].job_id)).toBeTruthy();await suspendJob(ids[2].job_id,false);
 const state=await readJob(owner,ids[2].job_id);expect(state.status).toBe('uncertain');expect(state.safe_error).toBe('POLL_LIMIT_RECONCILE');
});
it('opaque job ID is globally unique across owners',async()=>{
 const a=await createJob(owner,query,randomUUID()),b=await createJob(other,query,randomUUID());
 await expect(admin.query("insert into flight.jobs(owner_id,job_id,search_id,kind,idempotency_key,request_hash) values($1,$2,$3,'search',$4,'qa-duplicate')",[other,a.job_id,b.search_id,randomUUID()])).rejects.toMatchObject({code:'23505'});
});
it('stale workflow execution cannot claim or suspend an active execution',async()=>{
 const j=await createJob(owner,query,randomUUID());const claimed=await claimJob(j.job_id,'qa-current');expect(claimed).toBeTruthy();
 expect(await claimJob(j.job_id,'qa-old')).toBeNull();await suspendJob(j.job_id,false,'qa-old');expect((await readJob(owner,j.job_id)).status).toBe('running');
 await cancelJob(owner,j.job_id);await finalizeCancellation(j.job_id);expect((await readJob(owner,j.job_id)).status).toBe('cancelled');
});
it('null lease fails closed; active reconciliation cannot clear it; cancellation keeps known launch IDs',async()=>{
 const j=await createJob(owner,query,randomUUID()),claimed=await claimJob(j.job_id,'qa-ack'),callId=randomUUID();expect(claimed).toBeTruthy();
 await admin.query('update flight.jobs set lease_until=null where owner_id=$1 and job_id=$2',[owner,j.job_id]);await expect(reserveCall(claimed!,'must-not-reserve')).rejects.toThrow('LEASE_OR_CANCELLED');await expect(completeCall(claimed!,callId,[],null)).rejects.toThrow('LEASE_LOST');
 // Supplier IO is mocked, and this synthetic row never had a budget reservation or HTTP dispatch.
 try{
  await admin.query("update flight.jobs set lease_until=now()+interval '120 seconds' where owner_id=$1 and job_id=$2",[owner,j.job_id]);
  await admin.query("insert into flight.provider_calls(owner_id,job_id,call_id,operation_key,phase,ceiling_microusd,lease_version) values($1,$2,$3,'search','dispatching',1,$4)",[owner,j.job_id,callId,claimed!.lease_version]);
  const before=provider.status.mock.calls.length;expect(await reconcileKnownRun(owner,j.job_id)).toBeNull();expect(provider.status.mock.calls.length).toBe(before);
  await cancelJob(owner,j.job_id);await finalizeCancellation(j.job_id);await saveRun(claimed!,callId,'QAKnownNeverPaid','QADataset');
  expect((await admin.query('select run_id from flight.provider_calls where owner_id=$1 and call_id=$2',[owner,callId])).rows[0].run_id).toBe('QAKnownNeverPaid');
  await expect(saveRun(claimed!,callId,'QAConflicting','QADataset')).rejects.toThrow('RUN_ACK_CONFLICT');
  expect(await reconcileKnownRun(owner,j.job_id)).toMatchObject({status:'cancelled',provider_finished:true});expect((await readJob(owner,j.job_id)).status).toBe('cancelled');
 }finally{await admin.query('delete from flight.provider_calls where owner_id=$1 and call_id=$2',[owner,callId]);}
});
it('cancellation immediately before completion records terminal usage without publishing offers',async()=>{
 const j=await createJob(owner,query,randomUUID()),claimed=await claimJob(j.job_id,'qa-cancel-completion'),callId=randomUUID();expect(claimed).toBeTruthy();
 try{
  await admin.query("insert into flight.provider_calls(owner_id,job_id,call_id,operation_key,phase,ceiling_microusd,lease_version,run_id) values($1,$2,$3,'search','running',1,$4,'QASyntheticNeverPaid')",[owner,j.job_id,callId,claimed!.lease_version]);
  const candidates=parseSearch(economy.provider_response,query);expect(candidates.length).toBeGreaterThan(0);
  await cancelJob(owner,j.job_id);await finalizeCancellation(j.job_id);await completeCall(claimed!,callId,candidates,100);
  const row=(await admin.query('select phase,reported_microusd from flight.provider_calls where owner_id=$1 and call_id=$2',[owner,callId])).rows[0];expect(row).toMatchObject({phase:'succeeded',reported_microusd:'100'});expect((await readJob(owner,j.job_id)).status).toBe('cancelled');
  expect((await admin.query('select count(*)::int as n from flight.offers where owner_id=$1 and job_id=$2',[owner,j.job_id])).rows[0].n).toBe(0);
 }finally{await admin.query('delete from flight.checkpoints where owner_id=$1 and job_id=$2',[owner,j.job_id]);await admin.query('delete from flight.provider_calls where owner_id=$1 and call_id=$2',[owner,callId]);}
});

it('chain stages persist private references and safe coverage; replay preserves checkpoint and expires fail closed',async()=>{
 const j=await createJob(owner,query,randomUUID()),claimed=await claimJob(j.job_id,'qa-chain'),callId=randomUUID();expect(claimed).toBeTruthy();
 try{
  await admin.query("insert into flight.provider_calls(owner_id,job_id,call_id,operation_key,phase,ceiling_microusd,lease_version,run_id) values($1,$2,$3,'search','running',1,$4,'QASyntheticNeverPaid')",[owner,j.job_id,callId,claimed!.lease_version]);
  const fresh=parseSearch(economy.provider_response,query).map(o=>({...o,observed_at:new Date().toISOString(),expires_at:new Date(Date.now()+600000).toISOString()}));
  const next={mode:'booking' as const,token:'SYNTHETIC_PRIVATE_NOT_REPLAYABLE',selected:fresh[0].segments};
  await completeStage(claimed!,callId,fresh,100,next,{returned:126,selected:1});
  expect((await readJob(owner,j.job_id)).phase).toBe('booking');
  expect((await privateContinuation(claimed!,'booking')).token).toBe(next.token);
  const safe=(await admin.query('select safe_result from flight.checkpoints where owner_id=$1 and job_id=$2',[owner,j.job_id])).rows[0].safe_result;expect(safe.coverage).toEqual({returned:126,selected:1});expect(JSON.stringify(safe)).not.toContain(next.token);
  await expect(transaction('api',owner,async c=>c.query('select * from flight.provider_references'))).rejects.toMatchObject({code:'42501'});
  await completeStage(claimed!,callId,fresh,100,next,{returned:126,selected:1});expect((await admin.query('select count(*)::int as n from flight.offers where owner_id=$1 and job_id=$2',[owner,j.job_id])).rows[0].n).toBe(3);
  await admin.query("update flight.provider_references set expires_at=now()-interval '1 second' where owner_id=$1 and call_id=$2",[owner,callId]);await expect(privateContinuation(claimed!,'booking')).rejects.toThrow('PROVIDER_REFERENCE_EXPIRED');
  expect((await admin.query('select count(*)::int as n from flight.provider_references where owner_id=$1 and call_id=$2',[owner,callId])).rows[0].n).toBe(0);
  await cancelJob(owner,j.job_id);await finalizeCancellation(j.job_id);
 }finally{await purgeReferences(owner,j.job_id);await admin.query('delete from flight.offers where owner_id=$1 and job_id=$2',[owner,j.job_id]);await admin.query('delete from flight.checkpoints where owner_id=$1 and job_id=$2',[owner,j.job_id]);await admin.query('delete from flight.provider_calls where owner_id=$1 and call_id=$2',[owner,callId]);}
});
it('cancellation before a chain stage persists terminal usage but no tokens or candidates',async()=>{
 const j=await createJob(owner,query,randomUUID()),claimed=await claimJob(j.job_id,'qa-chain-cancel'),callId=randomUUID();expect(claimed).toBeTruthy();
 try{
  await admin.query("insert into flight.provider_calls(owner_id,job_id,call_id,operation_key,phase,ceiling_microusd,lease_version,run_id) values($1,$2,$3,'search','running',1,$4,'QASyntheticNeverPaid')",[owner,j.job_id,callId,claimed!.lease_version]);
  await cancelJob(owner,j.job_id);await completeStage(claimed!,callId,parseSearch(economy.provider_response,query),100,{mode:'booking',token:'SYNTHETIC_CANCELLED',selected:[]},{returned:126,selected:1});
  expect((await readJob(owner,j.job_id)).status).toBe('cancelled');expect((await admin.query('select phase from flight.provider_calls where owner_id=$1 and call_id=$2',[owner,callId])).rows[0].phase).toBe('succeeded');
  expect((await admin.query('select count(*)::int as n from flight.provider_references where owner_id=$1',[owner])).rows[0].n).toBe(0);expect((await admin.query('select count(*)::int as n from flight.offers where owner_id=$1 and job_id=$2',[owner,j.job_id])).rows[0].n).toBe(0);
 }finally{await purgeReferences(owner,j.job_id);await admin.query('delete from flight.checkpoints where owner_id=$1 and job_id=$2',[owner,j.job_id]);await admin.query('delete from flight.provider_calls where owner_id=$1 and call_id=$2',[owner,callId]);}
});
it('account/user reservations are atomic under concurrency and cancellation rejects pre-IO transition',async()=>{
 await transaction('worker',null,async c=>{await c.query('insert into flight.budget_accounts(account_key,cap_microusd,call_cap) values($1,30000,1)',[`owner:${owner}:${period}`]);});
 const a=await createJob(owner,query,randomUUID()),b=await createJob(owner,query,randomUUID());const ja=await claimJob(a.job_id),jb=await claimJob(b.job_id);expect(ja).toBeTruthy();expect(jb).toBeTruthy();
 const reservations=await Promise.allSettled([reserveCall(ja!,'qa-offline'),reserveCall(jb!,'qa-offline')]);expect(reservations.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(reservations.filter(r=>r.status==='rejected')).toHaveLength(1);
 const i=reservations[0].status==='fulfilled'?0:1,r=reservations[i];if(r.status!=='fulfilled')throw Error('RESERVE_TEST');const j=i===0?ja!:jb!;
 await admin.query('update flight.provider_calls set read_cap=2 where owner_id=$1 and call_id=$2',[owner,r.value.call_id]);
 const reads=await Promise.allSettled([reserveRead(owner,r.value.call_id),reserveRead(owner,r.value.call_id),reserveRead(owner,r.value.call_id)]);expect(reads.filter(r=>r.status==='fulfilled')).toHaveLength(2);expect(reads.filter(r=>r.status==='rejected')).toHaveLength(1);
 await cancelJob(owner,j.job_id);expect(await beginDispatch(j,r.value.call_id)).toBe(false);
});
