// Candidate discovery is independently authorized from confirmed recommendations.
// Separate reference permissions never promote source evidence to confirmed rights.
export function searchExecutionEnabled(){
 return process.env.LIVE_PROVIDER_ENABLED==='true'||process.env.LIVE_REFERENCE_SEARCH_ENABLED==='true';
}
export function jobExecutionEnabled(batchMember:boolean){
 return process.env.LIVE_PROVIDER_ENABLED==='true'||(batchMember?batchExecutionEnabled():process.env.LIVE_REFERENCE_SEARCH_ENABLED==='true');
}
export function batchExecutionEnabled(){return process.env.LIVE_PROVIDER_ENABLED==='true'||process.env.LIVE_REFERENCE_BATCH_ENABLED==='true';}
