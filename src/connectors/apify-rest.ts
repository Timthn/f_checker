import { safeRunBillingMetadata } from '../domain/billing';
const endpoint='https://api.apify.com/v2';
function headers(){const token=process.env.APIFY_API_TOKEN;if(!token)throw Error('MISSING_CREDENTIALS');return {'Authorization':`Bearer ${token}`,'Content-Type':'application/json'};}
const metadataBytes=256*1024,datasetBytes=2*1024*1024;
async function request(path:string,options:RequestInit={},maxBytes=metadataBytes):Promise<any>{
 const post=options.method==='POST',signal=AbortSignal.timeout(30000);let response:Response;
 try{response=await fetch(`${endpoint}${path}`,{...options,headers:headers(),signal,cache:'no-store'});}catch{throw Error(post?'DISPATCH_UNCERTAIN':'PROVIDER_UNAVAILABLE');}
 if(!response.ok){void response.body?.cancel().catch(()=>{});throw Error(post?'DISPATCH_UNCERTAIN':'PROVIDER_UNAVAILABLE');}
 const advertised=response.headers.get('content-length');
 if(advertised!==null&&/^\d+$/.test(advertised)&&Number(advertised)>maxBytes){void response.body?.cancel().catch(()=>{});throw Error(post?'DISPATCH_UNCERTAIN':'PROVIDER_RESPONSE_TOO_LARGE');}
 if(!response.body)throw Error(post?'DISPATCH_UNCERTAIN':'PROVIDER_SCHEMA_CHANGED');
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let total=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){void reader.cancel().catch(()=>{});throw Error('PROVIDER_RESPONSE_TOO_LARGE');}chunks.push(value);}
  const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }catch(error){void reader.cancel().catch(()=>{});throw Error(post?'DISPATCH_UNCERTAIN':error instanceof Error&&error.message==='PROVIDER_RESPONSE_TOO_LARGE'?'PROVIDER_RESPONSE_TOO_LARGE':signal.aborted?'PROVIDER_UNAVAILABLE':'PROVIDER_SCHEMA_CHANGED');}
 finally{reader.releaseLock();}
}
export async function startRun(input:unknown,ceilingMicrousd:number){
 if(!Number.isSafeInteger(ceilingMicrousd)||ceilingMicrousd<0)throw Error('INVALID_PROVIDER_CEILING');
 const result=await request(`/acts/scrapercompany~google-flights-scraper/runs?build=0.0.2&timeout=120&memory=256&maxTotalChargeUsd=${ceilingMicrousd/1000000}`,{method:'POST',body:JSON.stringify(input)});
 if(typeof result?.data?.id!=='string'||! /^[A-Za-z0-9]{1,64}$/.test(result.data.id)||typeof result?.data?.defaultDatasetId!=='string'||! /^[A-Za-z0-9]{1,64}$/.test(result.data.defaultDatasetId))throw Error('DISPATCH_UNCERTAIN');return {runId:result.data.id as string,datasetId:result.data.defaultDatasetId as string};
}
export async function runStatus(id:string){if(!/^[A-Za-z0-9]{1,64}$/.test(id))throw Error('INVALID_RUN');const r=await request(`/actor-runs/${id}`);return safeRunBillingMetadata({...r?.data,runId:id});}
export async function dataset(id:string){if(!/^[A-Za-z0-9]{1,64}$/.test(id))throw Error('INVALID_DATASET');const r=await request(`/datasets/${id}/items?limit=500&clean=true`,{},datasetBytes);if(!Array.isArray(r)||r.length>500)throw Error('PROVIDER_SCHEMA_CHANGED');return r;}
export async function accountData(kind:'user'|'limits'):Promise<unknown>{return request(kind==='user'?'/users/me':'/users/me/limits');}
