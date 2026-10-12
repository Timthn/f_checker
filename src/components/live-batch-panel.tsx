'use client';
import {useEffect,useRef,useState} from 'react';
import {useMutation,useQuery} from '@tanstack/react-query';
import {en,zh,type MessageKey} from '@/i18n/catalog';
import type {batchResults} from '@/domain/batch-results';
import {BatchCandidates} from './batch-candidates';
import {previewBatch} from '@/domain/batch-preview';

type Kind='meeting'|'flexible';
type Pending={key:string;request:Record<string,unknown>};
type MutationContext={owner?:string;generation:number};
type FencedError=Error&MutationContext;
type Status={batch_id:string;status:string;ceiling_microusd:number;items:{ordinal:number;status:string;phase:string;query:{origin:string;destination:string;departure:string;return_date?:string}}[]};
type Results=ReturnType<typeof batchResults>;
const terminal=(status?:string)=>!!status&&['partial','succeeded','failed','cancelled','uncertain'].includes(status);
const mayCreateNew=(status?:string)=>!!status&&['partial','succeeded','failed','cancelled'].includes(status);
const statusKey=(status:string):MessageKey=>({queued:'jobQueued',running:'jobRunning',partial:'jobPartial',succeeded:'jobSucceeded',failed:'jobFailed',cancelled:'jobCancelled',uncertain:'jobUncertain'} as Record<string,MessageKey>)[status]??'unknown';
const errorKey=(code?:string):MessageKey=>({AUTH_REQUIRED:'authRequired',INVALID_QUERY:'invalid',PERSISTENCE_NOT_READY:'notReady',PROVIDER_DISABLED:'notReady',LIVE_PROVIDER_DISABLED:'notReady',QUOTA_EXCEEDED:'quota',BATCH_BUDGET_EXCEEDED:'batchBudgetExceeded',BATCH_CALL_LIMIT:'batchCallLimit',LOCK_UNAVAILABLE:'batchLockUnavailable',IDEMPOTENCY_CONFLICT:'batchConflict'} as Record<string,MessageKey>)[code??'']??'error';

// This section never submits its surrounding saved-quote form. Only an explicit button
// dispatches a paid request. A timeout retains the identical key AND frozen request.
export function LiveBatchPanel({kind,request,locale,token,owner}:{kind:Kind;request:Record<string,unknown>;locale:'en'|'zh-Hans';token?:string;owner?:string}){
 const t=(k:MessageKey)=>(locale==='en'?en:zh)[k];
 const [budget,setBudget]=useState('0.10'),[scope,setScope]=useState('fixed_departures'),[strategy,setStrategy]=useState('heuristic'),[maxPairs,setMaxPairs]=useState(3);
 const [batchId,setBatchId]=useState<string|null>(null),[pending,setPending]=useState<Pending|null>(null),[ready,setReady]=useState(false),[message,setMessage]=useState<MessageKey|null>(null),[rejected,setRejected]=useState(false);
 const [storageWarning,setStorageWarning]=useState(false),[budgetInfo,setBudgetInfo]=useState<{required:number;available:number}|null>(null);
 const active=useRef(true),identity=useRef(owner),pendingRef=useRef<Pending|null>(null),generation=useRef(0),submissionActive=useRef(false);identity.current=owner;
 const current=(ctx:MutationContext)=>active.current&&identity.current===ctx.owner&&generation.current===ctx.generation;
 const storage=owner?`fc-batch:${owner}:${kind}`:null;
 useEffect(()=>{active.current=true;setReady(false);setBatchId(null);setPending(null);pendingRef.current=null;submissionActive.current=false;setMessage(null);setRejected(false);setStorageWarning(false);setBudgetInfo(null);setStrategy('heuristic');setMaxPairs(3);setScope('fixed_departures');
  if(storage)try{const saved=JSON.parse(localStorage.getItem(storage)??'null');if(saved?.pending?.key&&/^[a-f0-9-]{36}$/i.test(saved.pending.key)&&saved.pending.request&&typeof saved.pending.request==='object'){pendingRef.current=saved.pending;setPending(saved.pending);const amount=Number(saved.pending.request.max_budget_microusd);if(Number.isFinite(amount)&&amount>=30000&&amount<=500000)setBudget((amount/1e6).toFixed(2));if(['arrival_window','fixed_departures'].includes(saved.pending.request.departure_scope))setScope(saved.pending.request.departure_scope);}if(saved?.pending?.request){setStrategy(saved.pending.request.strategy==='heuristic'?'heuristic':'exhaustive');if(Number.isInteger(saved.pending.request.max_pairs)&&saved.pending.request.max_pairs>=1&&saved.pending.request.max_pairs<=8)setMaxPairs(saved.pending.request.max_pairs);}if(saved?.batch_id&&/^[a-f0-9-]{36}$/i.test(saved.batch_id))setBatchId(saved.batch_id);}catch{setStorageWarning(true);}
  setReady(true);return()=>{active.current=false;generation.current++;};
 },[storage]);
 const persist=(p:Pending|null,id:string|null)=>{if(storage)try{if(p||id)localStorage.setItem(storage,JSON.stringify({pending:p,batch_id:id}));else localStorage.removeItem(storage);}catch{setStorageWarning(true);}};
 const headers=()=>({Authorization:`Bearer ${token}`});
 const creation=useMutation({retry:false,mutationFn:async(ctx:MutationContext)=>{try{
  if(!current(ctx))throw Error('authRequired');
  if(current(ctx)){setRejected(false);setBudgetInfo(null);setMessage(null);}
  if(!token||!owner)throw Error('authRequired');
  let frozen=pendingRef.current;
  if(!frozen){const amount=Math.round(Number(budget)*1e6);if(!Number.isFinite(amount)||amount<30000||amount>500000)throw Error('invalid');frozen={key:crypto.randomUUID(),request:{...request,max_budget_microusd:amount,...(kind==='meeting'?{departure_scope:scope}:{strategy,max_pairs:maxPairs})}};}
  // Set synchronously: two click events before React commits share one admission key.
  pendingRef.current=frozen;setPending(frozen);persist(frozen,batchId);
  const r=await fetch('/api/v1/batches',{method:'POST',signal:AbortSignal.timeout(30000),headers:{...headers(),'Content-Type':'application/json','Idempotency-Key':frozen.key},body:JSON.stringify({kind,request:frozen.request})});
  const p=await r.json();if(!r.ok){
   // Only an explicit pre-admission rejection permits editing and a new key.
   // Network failures and ambiguous server errors retain the original request.
   if(current(ctx)&&['INVALID_QUERY','AUTH_REQUIRED','QUOTA_EXCEEDED','BATCH_BUDGET_EXCEEDED','BATCH_CALL_LIMIT','LOCK_UNAVAILABLE','LIVE_PROVIDER_DISABLED','PROVIDER_DISABLED'].includes(p.error?.code)){
    setRejected(true);
    const params=p.error?.params;
    if(['QUOTA_EXCEEDED','BATCH_BUDGET_EXCEEDED'].includes(p.error?.code)&&Number.isSafeInteger(params?.required_microusd)&&params.required_microusd>=0&&Number.isSafeInteger(params?.available_microusd)&&params.available_microusd>=0)setBudgetInfo({required:params.required_microusd,available:params.available_microusd});
   }
   throw Error(p.error?.code==='PERSISTENCE_NOT_READY'?'batchTimeout':errorKey(p.error?.code));
  }
  if(typeof p.batch_id!=='string'||!/^[a-f0-9-]{36}$/i.test(p.batch_id))throw Error('error');
  return {id:p.batch_id as string,...ctx,frozen};
 }catch(error){throw Object.assign(error instanceof Error?error:Error('error'),ctx);}
 },onSuccess:p=>{if(!current(p))return;setBatchId(p.id);persist(p.frozen,p.id);setMessage(null);},onError:e=>{if(current(e as FencedError))setMessage(e.name==='TimeoutError'||e.name==='AbortError'?'batchTimeout':e.message in en?e.message as MessageKey:'batchTimeout');},onSettled:(_data,_error,ctx)=>{if(current(ctx))submissionActive.current=false;}});
 const restore=()=>{if(submissionActive.current)return;submissionActive.current=true;creation.mutate({owner,generation:generation.current});};
 const status=useQuery({queryKey:['batch-status',owner,batchId],enabled:ready&&!!owner&&!!token&&!!batchId,queryFn:async()=>{const r=await fetch(`/api/v1/batches/${batchId}`,{headers:headers(),signal:AbortSignal.timeout(15000)});const p=await r.json();if(!r.ok)throw Error(errorKey(p.error?.code));return p as Status;},refetchInterval:q=>q.state.error?false:terminal(q.state.data?.status)?false:2000});
 const results=useQuery({queryKey:['batch-results',owner,batchId],enabled:ready&&!!owner&&!!token&&!!batchId,queryFn:async()=>{const r=await fetch(`/api/v1/batches/${batchId}/results`,{headers:headers(),signal:AbortSignal.timeout(15000)});const p=await r.json();if(!r.ok)throw Error(errorKey(p.error?.code));return p as Results;},refetchInterval:q=>q.state.error?false:terminal(status.data?.status)?false:2000});
 useEffect(()=>{if(terminal(status.data?.status))void results.refetch();},[status.data?.status]); // final result refresh is read-only
 const cancellation=useMutation({mutationFn:async(ctx:MutationContext)=>{try{const r=await fetch(`/api/v1/batches/${batchId}/cancel`,{method:'POST',headers:headers()});if(!r.ok)throw Error('error');return ctx;}catch(error){throw Object.assign(error instanceof Error?error:Error('error'),ctx);}},onSuccess:ctx=>{if(current(ctx)){void status.refetch();void results.refetch();}},onError:e=>{if(current(e as FencedError))setMessage('error');}});
 const money=(minor:number,currency:string,digits:number)=>new Intl.NumberFormat(locale,{style:'currency',currency}).format(minor/10**digits);
 const text=(v:unknown)=>typeof v==='string'?v:'—';
 const frozenRoutes=pending?[pending.request.a,pending.request.b,pending.request.base].filter((v):v is Record<string,unknown>=>!!v&&typeof v==='object'):[];
 const waiting=creation.isPending||!!batchId&&!terminal(status.data?.status);
 const previewRequest=pending?.request??{...request,max_budget_microusd:Math.round(Number(budget)*1e6),...(kind==='meeting'?{departure_scope:scope}:{strategy,max_pairs:maxPairs})};
 let preview:ReturnType<typeof previewBatch>|null=null;try{preview=previewBatch(kind,previewRequest);}catch{}
 const previewBudget=Number(previewRequest.max_budget_microusd);
 const previewOverBudget=!!preview&&preview.ceiling_microusd>previewBudget;
 const previewInvalid=!preview||!Number.isFinite(previewBudget)||previewBudget<30000||previewBudget>500000||kind==='flexible'&&previewRequest.strategy==='heuristic'&&(!Number.isInteger(previewRequest.max_pairs)||Number(previewRequest.max_pairs)<1||Number(previewRequest.max_pairs)>8);
 const clear=()=>{if(submissionActive.current||cancellation.isPending||batchId&&!mayCreateNew(status.data?.status)||!batchId&&!rejected)return;setBatchId(null);setPending(null);pendingRef.current=null;setMessage(null);setRejected(false);setBudgetInfo(null);persist(null,null);};
 return <section className="card" aria-label={t('liveBatch')}>
  <p className="eyebrow">{t('liveBatch')}</p><h2>{t('batchQuery')}</h2><p className="muted">{t('batchSourceGate')}</p>
  <div className="query"><label>{t('batchBudget')}<input type="number" min="0.03" max="0.50" step="0.01" value={budget} disabled={!!pending||waiting} onChange={e=>setBudget(e.target.value)}/></label>{kind==='meeting'&&<label>{t('batchDepartureScope')}<select value={scope} disabled={!!pending||waiting} onChange={e=>setScope(e.target.value)}><option value="arrival_window">{t('batchArrivalWindow')}</option><option value="fixed_departures">{t('batchFixedDepartures')}</option></select></label>}</div>
  {kind==='flexible'&&<div className="query"><label>{t('flexStrategy')}<select value={strategy} disabled={!!pending||waiting} onChange={e=>setStrategy(e.target.value)}><option value="heuristic">{t('flexHeuristic')}</option><option value="exhaustive">{t('flexExhaustive')}</option></select></label>{strategy==='heuristic'&&<label>{t('flexMaxPairs')}<input type="number" min="1" max="8" step="1" disabled={!!pending||waiting} value={maxPairs} onChange={e=>setMaxPairs(Number(e.target.value))}/></label>}</div>}
  {kind==='flexible'&&strategy==='heuristic'&&<p className="muted">{t('flexSamplingNotice')}</p>}
  <div role="region" aria-label={t('batchPlanPreview')} className="muted"><p>{t('batchPlanPreview')}</p>{preview?<p>{t('batchPlanQueries')} · {preview.queries} / {t('batchPlanCalls')} · {preview.calls} / {t('batchPlanCeiling')} · USD {(preview.ceiling_microusd/1e6).toFixed(2)}</p>:<p>{t('batchPlanInvalid')}</p>}{kind==='flexible'&&preview?.possible_queries!==undefined&&<p>{t('flexPlannedCoverage')} · {preview.queries} / {preview.possible_queries} · {t(preview.selection_basis==='exhaustive'?'flexExhaustive':'flexUniformPreview')}</p>}{previewOverBudget&&<p role="status">{t('batchPlanOverBudget')}</p>}{preview?.over_call_limit&&<p role="status">{t('batchCallLimit')}</p>}{kind==='meeting'&&!!previewRequest.lock_a&&<p>{t('batchPlanLock')}</p>}</div>
  <p>{t('batchBranchCoverage')}</p><p className="muted">{t('batchBudgetRule')}</p>
  {pending&&<div className="muted"><p>{t('batchFrozenRequest')} · USD {(Number(pending.request.max_budget_microusd)/1e6).toFixed(2)}</p>{frozenRoutes.map((route,i)=><p key={i}>{text(route.origin)} → {text(route.destination)} · {kind==='meeting'?`${t('arrivalDay')}: ${text(pending.request.arrival_day)} · ${t(pending.request.departure_scope==='fixed_departures'?'batchFixedDepartures':'batchArrivalWindow')}${pending.request.departure_scope==='fixed_departures'?` · ${text(route.departure)}`:''}`:`${text(pending.request.departure_from)} – ${text(pending.request.departure_to)} / ${text(pending.request.return_from)} – ${text(pending.request.return_to)}`}</p>)}</div>}
  {!batchId&&<button type="button" className="primary" disabled={!ready||creation.isPending||!owner||!token||!pending&&(previewInvalid||previewOverBudget||preview?.over_call_limit)} onClick={restore}>{t(creation.isPending?'loading':pending?'batchRestoreRequest':'batchPaidQuery')}</button>}
  {!owner&&<p>{t('authRequired')}</p>}
  {message&&<p role="alert">{t(message)}</p>}
  {storageWarning&&<p role="alert">{t('batchStorageUnavailable')}</p>}
  {budgetInfo&&<p>{t('batchRequiredBudget')} · USD {(budgetInfo.required/1e6).toFixed(2)} / {t('batchAvailableBudget')} · USD {(budgetInfo.available/1e6).toFixed(2)}</p>}
  {pending&&!batchId&&!rejected&&<p className="muted">{t('batchPendingSafety')}</p>}
  {pending&&!batchId&&rejected&&<button type="button" disabled={creation.isPending} onClick={clear}>{t('batchRevise')}</button>}
  {batchId&&<><p role="status" aria-live="polite">{t(statusKey(status.data?.status??'queued'))}</p><div className="chart-toolbar"><button type="button" onClick={()=>{void status.refetch();void results.refetch();}}>{t('batchRefresh')}</button>{['queued','running'].includes(status.data?.status??'')&&<><button type="button" disabled={creation.isPending||!pending} onClick={restore}>{t('batchResumeTask')}</button><button type="button" disabled={cancellation.isPending} onClick={()=>cancellation.mutate({owner,generation:generation.current})}>{t('cancel')}</button></>}{mayCreateNew(status.data?.status)&&<button type="button" disabled={creation.isPending||cancellation.isPending} onClick={clear}>{t('batchNewQuery')}</button>}</div>
   {status.data&&<p>{t('batchReserved')} · USD {(Number(status.data.ceiling_microusd)/1e6).toFixed(2)}</p>}
   {(status.error||results.error)&&<p role="alert">{t('batchReadError')}</p>}
   <div className="fare-list">{status.data?.items.map(item=><div className="fare-row" key={item.ordinal}><span>{item.query.origin} → {item.query.destination}<small>{item.query.departure}{item.query.return_date?` → ${item.query.return_date}`:''}</small></span><span>{t(statusKey(item.status))}</span></div>)}</div>
   {results.data&&<><section aria-label={t('referenceRecommendations')}><h3>{t('referenceRecommendations')}</h3><p className="muted">{t('referenceNotice')}</p>{results.data.kind==='meeting'?<>{!(results.data.reference_pairs??[]).length&&<p>{t('referenceNoResults')}</p>}{(results.data.reference_pairs??[]).map(p=><div className="fare-row" key={`reference/${p.a.offer_id}/${p.b.offer_id}`}><span>{p.a.segments.map(s=>s.flight).join(' / ')} + {p.b.segments.map(s=>s.flight).join(' / ')}<small>{t('referenceClock')} · A {p.arrival_a} / B {p.arrival_b} · {p.zone??t('unknown')}</small></span><strong>{money(p.total,p.a.money.currency,p.a.money.digits)}</strong><span>{p.gap} {t('batchMinutes')} · {t('unknown')}</span></div>)}{!!results.data.reference_alternatives?.length&&<><h4>{t('referenceAlternatives')}</h4>{results.data.reference_alternatives.map(p=><div className="fare-row" key={`reference-alt/${p.a.offer_id}/${p.b.offer_id}`}><span>{p.a.segments.map(s=>s.flight).join(' / ')} + {p.b.segments.map(s=>s.flight).join(' / ')}<small>{t('referenceClock')} · A {p.arrival_a} / B {p.arrival_b} · {p.zone??t('unknown')}</small></span><strong>{money(p.total,p.a.money.currency,p.a.money.digits)}</strong><span>{p.gap} {t('batchMinutes')} · {t('unknown')}</span></div>)}</>}</>:<>{!(results.data.reference_recommendations??[]).length&&<p>{t('referenceNoResults')}</p>}{(results.data.reference_recommendations??[]).map(r=><div className="fare-row" key={`reference/${r.offer.offer_id}`}><span>{r.offer.segments.map(s=>s.flight).join(' / ')}<small>{r.nights} {t('nights')} · {t('referenceClock')}</small></span><strong>{money(r.offer.money.minor,r.offer.money.currency,r.offer.money.digits)}</strong><span>{t('unknown')}</span></div>)}{!!results.data.reference_cells?.length&&<><h4>{t('referenceDatePrices')}</h4><div className="calendar-grid">{results.data.reference_cells.map(c=><div className="card" key={`reference/${c.departure}/${c.return_date}`}><span>{c.departure} → {c.return_date}</span><strong>{c.money?money(c.money.minor,c.money.currency,c.money.digits):'—'}</strong><small>{t('unknown')}</small></div>)}</div></>}</>}</section><BatchCandidates groups={results.data.source_candidates??[]} locale={locale}/><p>{t('batchCoverage')} · {results.data.coverage.query_constraints_verified} / {results.data.coverage.searched} / {results.data.coverage.admitted}</p>{results.data.kind==='meeting'?<><h3>{t('alternatives')}</h3>{!results.data.pairs.length&&<p>{t('noPairs')}</p>}{results.data.pairs.map(p=><div className="fare-row" key={`${p.a.offer_id}/${p.b.offer_id}`}><span>{p.a.segments.map(s=>s.flight).join(' / ')} + {p.b.segments.map(s=>s.flight).join(' / ')}</span><strong>{money(p.total,p.a.money.currency,p.a.money.digits)}</strong><span>{p.gap} {t('batchMinutes')}</span></div>)}{!!results.data.alternatives.length&&<><h3>{t('batchGapAlternatives')}</h3>{results.data.alternatives.map(p=><div className="fare-row" key={`${p.a.offer_id}/${p.b.offer_id}`}><span>{p.a.segments.map(s=>s.flight).join(' / ')} + {p.b.segments.map(s=>s.flight).join(' / ')}</span><strong>{money(p.total,p.a.money.currency,p.a.money.digits)}</strong><span>{p.gap} {t('batchMinutes')}</span></div>)}</>}</>:<><div className="calendar-grid">{results.data.cells.map(c=><div className="card" key={`${c.departure}/${c.return_date}`}><span>{c.departure} → {c.return_date}</span><strong>{c.money?money(c.money.minor,c.money.currency,c.money.digits):'—'}</strong><small>{t(c.state==='verified'?'confirmed':'unknown')} · {t(statusKey(c.query_status))}</small></div>)}</div><p>{t('coverage')} · {results.data.coverage.verified_cells} / {results.data.coverage.searched} / {results.data.coverage.admitted}</p>{!results.data.recommendations.length&&<p>{t('noMinimum')}</p>}{results.data.recommendations.map(o=><div className="fare-row" key={o.offer_id}><span>{o.segments.map(s=>s.flight).join(' / ')}<small>{o.nights} {t('nights')}</small></span><strong>{money(o.money.minor,o.money.currency,o.money.digits)}</strong></div>)}</>}</>}
  </>}
 </section>;
}
