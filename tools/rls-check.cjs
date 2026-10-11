const {Client}=require('pg'),fs=require('node:fs'),crypto=require('node:crypto');process.loadEnvFile('.env');process.loadEnvFile('.env.migration');
const ssl={rejectUnauthorized:true,ca:fs.readFileSync('config/supabase-ca.crt','utf8')};
const admin=new Client({connectionString:process.env.MIGRATION_DATABASE_URL,ssl,connectionTimeoutMillis:10000}),api=new Client({connectionString:process.env.DATABASE_URL,ssl,connectionTimeoutMillis:10000}),worker=new Client({connectionString:process.env.WORKER_DATABASE_URL,ssl,connectionTimeoutMillis:10000});
const a=crypto.randomUUID(),b=crypto.randomUUID(),sa=crypto.randomUUID(),sb=crypto.randomUUID();const checks=[];
function check(name,ok){checks.push({name,passed:!!ok});if(!ok)throw Error(name);}
async function asOwner(id,fn){await api.query('begin');await api.query("select set_config('app.user_id',$1,true)",[id]);try{return await fn();}finally{await api.query('rollback');}}
async function denied(sql,args){try{await api.query(sql,args);return false;}catch(e){return e.code==='42501';}}
(async()=>{try{
 await Promise.all([admin.connect(),api.connect(),worker.connect()]);
 const roles=await api.query('select current_user as role,rolbypassrls,rolsuper from pg_roles where rolname=current_user');check('actual API role has no bypass/superuser',roles.rows[0].role==='fc_api'&&!roles.rows[0].rolbypassrls&&!roles.rows[0].rolsuper);
 await admin.query("insert into auth.users(id,email,aud,role) values($1,$2,'authenticated','authenticated'),($3,$4,'authenticated','authenticated')",[a,`qa-${a}@example.invalid`,b,`qa-${b}@example.invalid`]);
 await admin.query('insert into flight.searches(owner_id,search_id,query,fingerprint) values($1,$2,$3,$4),($5,$6,$3,$4)',[a,sa,{test:'rls-isolated'},'qa',b,sb]);
 check('missing context sees no rows',(await api.query('select * from flight.searches')).rows.length===0);
 await asOwner(a,async()=>{const rows=(await api.query('select owner_id from flight.searches')).rows;check('owner A sees only A',rows.length===1&&rows[0].owner_id===a);check('cross-owner insert denied',await denied('insert into flight.searches(owner_id,search_id,query,fingerprint) values($1,$2,$3,$4)',[b,crypto.randomUUID(),{},'qa']));});
 await asOwner(b,async()=>check('owner B sees only B',(await api.query('select owner_id from flight.searches')).rows.every(r=>r.owner_id===b)));
 check('context reset after transaction',(await api.query('select * from flight.searches')).rows.length===0);
 check('API denied private provider references',await denied('select * from flight.provider_references'));
 const w=(await worker.query('select current_user as role,rolbypassrls,rolsuper from pg_roles where rolname=current_user')).rows[0];check('actual worker has no bypass/superuser',w.role==='fc_worker'&&!w.rolbypassrls&&!w.rolsuper);
 check('worker budget preserves original reservations',(await worker.query("select reserved_microusd from flight.budget_accounts where account_key='spike-lifetime'")).rows[0].reserved_microusd==='270000');
 await worker.query('begin');let deniedDdl=false;try{await worker.query('create table flight.qa_forbidden(x int)');}catch(e){deniedDdl=e.code==='42501';}await worker.query('rollback');check('worker cannot create tables',deniedDdl);
 await worker.query('begin');let fk=false;try{await worker.query("insert into flight.jobs(owner_id,job_id,search_id,kind,idempotency_key,request_hash) values($1,$2,$3,'search',$4,'qa')",[a,crypto.randomUUID(),sb,crypto.randomUUID()]);}catch(e){fk=e.code==='23503';}await worker.query('rollback');check('cross-owner parent reference denied',fk);
 }catch(e){console.log(JSON.stringify({ok:false,code:e.code||e.message}));process.exitCode=1;}finally{
 try{await admin.query('delete from flight.searches where owner_id=any($1::uuid[])',[ [a,b] ]);await admin.query('delete from auth.users where id=any($1::uuid[])',[[a,b]]);}catch{process.exitCode=1;}
 await Promise.allSettled([admin.end(),api.end(),worker.end()]);fs.mkdirSync('docs/qa',{recursive:true});fs.writeFileSync('docs/qa/rls-results.json',JSON.stringify({evidence:'actual_restricted_role_connections',project_ref:'fpxnoiwaytkplrfsymyp',checks},null,2));console.log(JSON.stringify({passed:checks.filter(x=>x.passed).length,total:checks.length}));}
})();
