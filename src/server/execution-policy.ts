// Candidate discovery is independently authorized from confirmed recommendations.
// The reference switch permits individual user-triggered searches, never batches.
export function searchExecutionEnabled(){
 return process.env.LIVE_PROVIDER_ENABLED==='true'||process.env.LIVE_REFERENCE_SEARCH_ENABLED==='true';
}
export function jobExecutionEnabled(batchMember:boolean){
 return process.env.LIVE_PROVIDER_ENABLED==='true'||(!batchMember&&process.env.LIVE_REFERENCE_SEARCH_ENABLED==='true');
}
