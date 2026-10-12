import {Temporal} from '@js-temporal/polyfill';
type Range={departure_from:string;departure_to:string;return_from:string;return_to:string;strategy?:'heuristic'|'exhaustive';max_pairs?:number};
export type DatePair={departure:string;return_date:string};
export type ExplorationSeed=DatePair&{minor:number};
export function selectFlexiblePairs(q:Range,seeds:ExplorationSeed[]=[]){
 const start=Temporal.PlainDate.from(q.departure_from),end=Temporal.PlainDate.from(q.departure_to),back=Temporal.PlainDate.from(q.return_from),last=Temporal.PlainDate.from(q.return_to);
 const width=start.until(end).days+1,height=back.until(last).days+1;
 if(width<1||height<1||width*height>400)throw Error('QUOTA');
 const all:DatePair[]=[];for(let i=0;i<width;i++)for(let j=0;j<height;j++)all.push({departure:start.add({days:i}).toString(),return_date:back.add({days:j}).toString()});
 if(q.strategy!=='heuristic')return {pairs:all,possible_queries:all.length,selection_basis:'exhaustive' as const};
 const limit=Math.min(q.max_pairs??3,all.length);if(!Number.isInteger(limit)||limit<1||limit>8)throw Error('INVALID_RANGE');
 const key=(p:DatePair)=>`${p.departure}/${p.return_date}`,pool=new Map(all.map(p=>[key(p),p])),chosen=new Map<string,DatePair>();
 const add=(p:DatePair)=>{const k=key(p);if(chosen.size<limit&&pool.has(k))chosen.set(k,pool.get(k)!);};
 const valid=seeds.filter(s=>pool.has(key(s))&&Number.isSafeInteger(s.minor)&&s.minor>0).sort((a,b)=>a.minor-b.minor||key(a).localeCompare(key(b)));
 // Admission only: no background phase, no extra calls. Neighbors are re-quoted.
 for(const seed of valid.slice(0,2)){
  for(const [d,r] of [[-1,0],[1,0],[0,-1],[0,1]] as const)add({departure:Temporal.PlainDate.from(seed.departure).add({days:d}).toString(),return_date:Temporal.PlainDate.from(seed.return_date).add({days:r}).toString()});
 }
 const neighborCount=chosen.size;
 // Deterministic farthest-point sampling spans both axes, unlike row-major truncation.
 if(!chosen.size)add(all[Math.floor((width-1)/2)*height+Math.floor((height-1)/2)]);
 const distance=(a:DatePair,b:DatePair)=>((start.until(Temporal.PlainDate.from(a.departure)).days-start.until(Temporal.PlainDate.from(b.departure)).days)/Math.max(1,width-1))**2+((back.until(Temporal.PlainDate.from(a.return_date)).days-back.until(Temporal.PlainDate.from(b.return_date)).days)/Math.max(1,height-1))**2;
 while(chosen.size<limit){let best:DatePair|null=null,score=-1;for(const p of all){if(chosen.has(key(p)))continue;const nearest=Math.min(...[...chosen.values()].map(c=>distance(p,c)));if(nearest>score){score=nearest;best=p;}}if(!best)break;add(best);}
 return {pairs:[...chosen.values()],possible_queries:all.length,selection_basis:neighborCount?'saved_quote_neighbors' as const:'uniform' as const};
}
