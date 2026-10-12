// Read-only real database verification. No new Auth user, ledger mutation or provider IO.
import {beforeAll,afterAll,it,expect} from 'vitest';
import {Client} from 'pg';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {offerDetails} from '../src/server/analysis';
import {ownerUsage,usageMonth} from '../src/server/usage';
import {pool} from '../src/server/db';
process.loadEnvFile('.env');process.loadEnvFile('.env.migration');
const uri=new URL(process.env.MIGRATION_DATABASE_URL!);
if(uri.hostname!=='aws-0-ap-southeast-1.pooler.supabase.com'||decodeURIComponent(uri.username)!=='postgres.fpxnoiwaytkplrfsymyp')throw Error('PROJECT_BOUNDARY');
const admin=new Client({connectionString:uri.toString(),connectionTimeoutMillis:10000,ssl:{rejectUnauthorized:true,ca:readFileSync('config/supabase-ca.crt','utf8')}});
let stored:{owner_id:string;offer_id:string;payload:Record<string,unknown>};
beforeAll(async()=>{await admin.connect();const result=await admin.query("select owner_id,offer_id,payload from flight.offers where payload->>'source' like 'apify/%' order by observed_at desc limit 1");if(!result.rows[0])throw Error('NO_SAVED_SOURCE_QUOTE');stored=result.rows[0];});
afterAll(async()=>{await admin.end();await Promise.all([pool('api').end(),pool('worker').end()]);});
it('real API role can read owned detail with a 61-day window and denies foreign detail',async()=>{
 const details=await offerDetails(stored.owner_id,stored.offer_id);expect(details?.offer.money).toEqual(stored.payload.money);expect(details?.departure_prices).toHaveLength(61);expect(await offerDetails(randomUUID(),stored.offer_id)).toBeNull();
});
it('real worker aggregate matches scoped saved calls and a foreign owner has zero totals',async()=>{
 const now=new Date(),period=usageMonth(now),summary=await ownerUsage(stored.owner_id,now);
 const raw=(await admin.query('select count(*) filter(where run_id is not null)::int as n from flight.provider_calls where owner_id=$1 and created_at >=$2::timestamptz and created_at <$3::timestamptz',[stored.owner_id,period.period_start,period.period_end])).rows[0];
 expect(summary.run_count).toBe(raw.n);expect(summary.monthly_reference_budget_microusd).toBe(5000000);expect(summary.invoice_confirmed).toBe(false);
 const empty=await ownerUsage(randomUUID(),now);expect(empty.run_count).toBe(0);expect(empty.reported_subtotal_microusd).toBe(0);
});
