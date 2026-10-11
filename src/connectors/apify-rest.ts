const endpoint='https://api.apify.com/v2';
function headers(){const token=process.env.APIFY_API_TOKEN;if(!token)throw Error('MISSING_CREDENTIALS');return {'Authorization':`Bearer ${token}`,'Content-Type':'application/json'};}
async function request(path:string,options:RequestInit={}){let response;try{response=await fetch(`${endpoint}${path}`,{...options,headers:headers(),signal:AbortSignal.timeout(30000),cache:'no-store'});}catch{throw Error(options.method==='POST'?'DISPATCH_UNCERTAIN':'PROVIDER_UNAVAILABLE');}if(!response.ok)throw Error(options.method==='POST'?'DISPATCH_UNCERTAIN':'PROVIDER_UNAVAILABLE');try{return await response.json();}catch{throw Error(options.method==='POST'?'DISPATCH_UNCERTAIN':'PROVIDER_SCHEMA_CHANGED');}}
export async function startRun(input:unknown,ceilingMicrousd:number){
 const result=await request(`/acts/scrapercompany~google-flights-scraper/runs?build=0.0.2&timeout=120&memory=256&maxTotalChargeUsd=${ceilingMicrousd/1000000}`,{method:'POST',body:JSON.stringify(input)});
 if(typeof result.data?.id!=='string'||typeof result.data?.defaultDatasetId!=='string')throw Error('DISPATCH_UNCERTAIN');return {runId:result.data.id as string,datasetId:result.data.defaultDatasetId as string};
}
export async function runStatus(id:string){if(!/^[A-Za-z0-9]+$/.test(id))throw Error('INVALID_RUN');const r=await request(`/actor-runs/${id}`);return {status:r.data?.status as string,usage:r.data?.usageTotalUsd as number|undefined};}
export async function dataset(id:string){if(!/^[A-Za-z0-9]+$/.test(id))throw Error('INVALID_DATASET');const r=await request(`/datasets/${id}/items?limit=500&clean=true`);if(!Array.isArray(r))throw Error('PROVIDER_SCHEMA_CHANGED');return r;}
export async function accountData(kind:'user'|'limits'):Promise<unknown>{return request(kind==='user'?'/users/me':'/users/me/limits');}
