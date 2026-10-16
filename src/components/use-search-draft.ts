'use client';
import {useEffect,useRef,useState} from 'react';
import type {Search} from '@/domain/contracts';
import {readSearchDraft,searchDraftKey,serializeSearchDraft} from '@/domain/search-draft';
export function useSearchDraft(initial:Search,owner?:string){
 const defaults=useRef(initial),key=searchDraftKey(owner);
 const [state,setState]=useState<{key:string|null;query:Search}>({key:null,query:initial}),[warning,setWarning]=useState(false);
 useEffect(()=>{let query=defaults.current;setWarning(false);try{query=readSearchDraft(localStorage,owner)??query;}catch{setWarning(true);}setState({key,query});},[key,owner]);
 useEffect(()=>{if(state.key!==key)return;try{localStorage.setItem(key,serializeSearchDraft(state.query));}catch{setWarning(true);}},[key,state]);
 return {query:state.key===key?state.query:defaults.current,setQuery:(query:Search)=>setState({key,query}),ready:state.key===key,warning};
}
