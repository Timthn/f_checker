import {beforeAll,afterAll,afterEach,it,expect,vi} from 'vitest';
import {Client} from 'pg';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const f=vi.hoisted(()=>({status:vi.fn()}));
vi.mock('../src/connectors/apify-rest',()=>({runStatus:f.status}));
import {captureRunBilling,publicJobBilling,reconcileJobBilling} from '../src/server/billing-evidence';
import {projectReportedCost} from '../src/server/reported-cost';
import {recordRouteHistory} from '../src/server/route-history-recording';
import {parseRouteHistory} from '../src/domain/route-history';
import {createJob} from '../src/server/jobs';
import {transaction,pool} from '../src/server/db';
import type {Search} from '../src/domain/contracts';
process.loadEnvFile('.env');process.loadEnvFile('.env.migration');
const uri=new URL(process.env.MIGRATION_DATABASE_URL!);if(uri.hostname!=='aws-0-ap-southeast-1.pooler.supabase.com'||decodeURIComponent(uri.username)!=='postgres.fpxnoiwaytkplrfsymyp')throw Error('PROJECT_BOUNDARY');
const admin=new Client({connectionString:process.env.MIGRATION_DATABASE_URL,ssl:{rejectUnauthorized:true,ca:readFileSync('config/supabase-ca.crt','utf8')}}),owner=randomUUID(),other=randomUUID();let baseline:string;
const q:Search={origin:'HKG',destination:'NRT',departure:'2026-11-10',cabin:'economy',adults:1,currency:'HKD',carry_on:0,checked:0};
const fixture=JSON.parse(readFileSync('docs/connectors/fixtures/apify-build-0.0.2/economy-one-way.json','utf8')).provider_response;
beforeAll(async()=>{await admin.connect();baseline=String((await admin.query("select reserved_microusd from flight.budget_accounts where account_key='spike-lifetime'")).rows[0].reserved_microusd);await admin.query("insert into auth.users(id,email,aud,role) values($1,$2,'authenticated','authenticated'),($3,$4,'authenticated','authenticated')",[owner,`qa-${owner}@example.invalid`,other,`qa-${other}@example.invalid`]);});
afterEach(async()=>{for(const t of ['billing_evidence','route_history_snapshots','observations','calendar_cells','offers','provider_references','checkpoints','provider_calls','jobs','searches'])await admin.query(`delete from flight.${t} where owner_id=$1`,[owner]);expect(String((await admin.query("select reserved_microusd from flight.budget_accounts where account_key='spike-lifetime'")).rows[0].reserved_microusd)).toBe(baseline);vi.clearAllMocks();});
afterAll(async()=>{await admin.query('delete from auth.users where id=any($1::uuid[])',[[owner,other]]);await admin.end();await Promise.all([pool('api').end(),pool('worker').end()]);});
async function setup(operations=['search']){
 const j=await createJob(owner,q,randomUUID()),calls: {id:string;run:string}[]=[];
 // Fixture-only private provider rows. No HTTP, monetary reservation or real run.
 for(const op of operations){const id=randomUUID(),run='QAFee'+id.replaceAll('-','');await admin.query("insert into flight.provider_calls(owner_id,job_id,call_id,operation_key,phase,ceiling_microusd,lease_version,run_id) values($1,$2,$3,$4,'failed',30000,0,$5)",[owner,j.job_id,id,op,run]);calls.push({id,run});}
 return {j,calls};
}
it('stores route references once and enforces owner, call/job, and private billing access',async()=>{
 const {j,calls}=await setup(['search','booking']),snapshot=parseRouteHistory(fixture,q,new Date().toISOString())!;
 const write=()=>transaction('worker',null,c=>recordRouteHistory(c,owner,j.job_id,calls[0].id,q,Object.assign(snapshot,{booking_token:'QA_NOT_A_REAL_TOKEN'})));
 await write();await write();const own=await transaction('api',owner,c=>c.query('select payload from flight.route_history_snapshots where owner_id=$1',[owner]));expect(own.rows).toHaveLength(1);expect(own.rows[0].payload.booking_token).toBeUndefined();
 expect((await transaction('api',other,c=>c.query('select * from flight.route_history_snapshots where owner_id=$1',[owner]))).rows).toHaveLength(0);
 await expect(transaction('api',owner,c=>c.query('select * from flight.billing_evidence'))).rejects.toMatchObject({code:'42501'});
 const otherJob=await createJob(owner,q,randomUUID());await expect(transaction('worker',null,c=>recordRouteHistory(c,owner,otherJob.job_id,calls[1].id,q,snapshot))).rejects.toMatchObject({code:'23503'});
});
it('retains delayed stable evidence and prevents stale completion or metadata overwrite',async()=>{
 const {j,calls}=await setup(),now=Date.now(),meta={runId:calls[0].run,status:'FAILED',usage:0.006,finishedAt:new Date(now-60000).toISOString(),pricingInfo:{pricingModel:'PAY_PER_EVENT'},chargedEventCounts:{search:1},platformUsageBillingModel:'USER',booking_token:'QA_NOT_A_REAL_TOKEN'};
 await captureRunBilling(owner,calls[0].id,meta,new Date(now-20000).toISOString());await captureRunBilling(owner,calls[0].id,meta,new Date(now).toISOString());
 await captureRunBilling(owner,calls[0].id,{...meta,usage:0.001},new Date(now-40000).toISOString());
 await transaction('worker',null,async c=>{await c.query('select call_id from flight.provider_calls where owner_id=$1 and call_id=$2 for update',[owner,calls[0].id]);await projectReportedCost(c,owner,calls[0].id,100);});
 expect((await admin.query('select reported_microusd from flight.provider_calls where owner_id=$1 and call_id=$2',[owner,calls[0].id])).rows[0].reported_microusd).toBe('6000');
 const summary=await publicJobBilling(owner,j.job_id);expect(summary).toMatchObject({reported_actor_microusd:6000,state:'stable_api_observation',exact_job_total_microusd:null,measured_external_microusd:null,invoice_confirmed:false});expect(JSON.stringify(summary)).not.toMatch(/QAFee|QA_NOT_A_REAL_TOKEN|run_id|call_id/);expect(await publicJobBilling(other,j.job_id)).toBeNull();
});
it('a capped search metadata read cannot starve later return and booking evidence',async()=>{
 const {j,calls}=await setup(['search','return','booking']);await admin.query('update flight.provider_calls set reads_reserved=read_cap where owner_id=$1 and call_id=$2',[owner,calls[0].id]);
 f.status.mockImplementation(async(runId:string)=>({runId,status:'FAILED',usage:0.002,finishedAt:new Date(Date.now()-60000).toISOString()}));
 const summary=await reconcileJobBilling(owner,j.job_id);expect(summary?.reconciliation).toEqual({attempted:3,captured:2,pending:1});expect(f.status).toHaveBeenCalledTimes(2);expect(summary?.reported_actor_microusd).toBeNull();expect(summary?.calls.filter(c=>c.reported_microusd===2000)).toHaveLength(2);
});
