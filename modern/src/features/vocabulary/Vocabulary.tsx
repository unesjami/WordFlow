import {useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import type {Word} from '../../domain';
import type {User} from '@supabase/supabase-js';
import {Profile} from '../profile/Profile';
import {recordActivity} from '../profile/analytics';
import {openWorkspace,storeLocal,makeSnapshot,syncLocal} from '../../services/offline';
import type {Snapshot} from '../../services/offline';
import {searchWords,saveWord,removeWord} from './model';
import {translate,detectLanguage} from '../../services/translation';
import {speakEnglish,stopSpeech} from '../../services/speech';
import {ReviewPanel} from '../learning/ReviewPanel';
import {PracticePanel} from '../learning/PracticePanel';

export function Vocabulary({userId,user}:{userId:string;user:User}){
 const [view,setView]=useState<'vocabulary'|'review'|'practice'|'profile'>('vocabulary');
 const [words,setWords]=useState<Word[]|null>(null);
 const snapshot=useRef<Snapshot|null>(null);
 const [syncStatus,setSyncStatus]=useState('Loading');
 const [query,setQuery]=useState('');
 const [en,setEn]=useState('');
 const [fa,setFa]=useState('');
 const [editing,setEditing]=useState<number|null>(null);
 const [deleting,setDeleting]=useState<number|null>(null);
 const [busy,setBusy]=useState(false);
 const [blocked,setBlocked]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const generation=useRef(0);
 const locked=useRef(false);
 const [reload,setReload]=useState(0);
 const [source,setSource]=useState('');
 const [translating,setTranslating]=useState(false);
 const translationRequest=useRef<AbortController|null>(null);
 useEffect(()=>()=>{translationRequest.current?.abort();stopSpeech();},[]);
 async function translateInput(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(translating||busy||blocked||!source.trim())return;
  translationRequest.current?.abort();const controller=new AbortController();translationRequest.current=controller;setTranslating(true);setError('');setNotice('');
  const text=source.trim(),language=detectLanguage(text);
  try{const result=await translate(text,language,language==='en'?'fa':'en',controller.signal);if(controller.signal.aborted)return;setEditing(null);setDeleting(null);setEn(language==='en'?text:result);setFa(language==='fa'?text:result);setNotice('Translation ready. Check the meaning and select Add to save.');}
  catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Translation failed.');}
  finally{if(translationRequest.current===controller&&!controller.signal.aborted)setTranslating(false);}
 }
 useEffect(()=>{
   const current=++generation.current;
   setWords(null);snapshot.current=null;setError('');setBlocked(false);setBusy(false);locked.current=false;setEditing(null);setDeleting(null);setEn('');setFa('');setNotice('');
   openWorkspace(userId).then(result=>{if(generation.current===current){snapshot.current=result;setWords(result.words);setSyncStatus(result.dirty?'Pending sync':'Saved locally');}}).catch(()=>{if(generation.current===current)setError('Could not load vocabulary. Your data was not changed.');});
   return ()=>{generation.current++;};
 },[userId,reload]);
 function reset(){setEditing(null);setEn('');setFa('');}
 async function persist(next:Word[],success:string):Promise<boolean>{
   if(locked.current||blocked||words===null)return false;
   locked.current=true;setBusy(true);setError('');setNotice('');
   const current=generation.current;
   try{const previous=snapshot.current;if(!previous)throw Error('Workspace unavailable');const local=makeSnapshot(userId,next,previous.revision,true);await storeLocal(local,previous.version);if(generation.current!==current)return false;snapshot.current=local;setWords(next);setSyncStatus('Pending sync');reset();setDeleting(null);setNotice(success+' Saved on this device.');return true;}
   catch(e){if(generation.current===current){setBlocked(true);setError(e instanceof Error?e.message:'Save failed. Reload before retrying.');}return false;}
   finally{if(generation.current===current){locked.current=false;setBusy(false);}}
 }
 useEffect(()=>{let active=true;async function flush(){const local=snapshot.current;if(!active||!local?.dirty||locked.current||!navigator.onLine)return;locked.current=true;setBusy(true);setSyncStatus('Syncing');try{const clean=await syncLocal(local);if(active&&snapshot.current?.version===local.version){snapshot.current=clean;setSyncStatus('Synced');}}catch(e){if(active){setSyncStatus('Pending sync');setError(e instanceof Error?e.message:'Cloud sync unavailable. Local changes preserved.');}}finally{if(active){locked.current=false;setBusy(false);}}}const timer=window.setInterval(()=>void flush(),15000);window.addEventListener('online',flush);void flush();return()=>{active=false;window.clearInterval(timer);window.removeEventListener('online',flush);};},[userId,reload]);
 function exportLocal(){const local=snapshot.current;if(!local)return;const url=URL.createObjectURL(new Blob([JSON.stringify({words:local.words,revision:local.revision},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='wordflow-local-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(words===null||busy||blocked||translating)return;try{void persist(saveWord(words,en,fa,editing),editing===null?'Word added.':'Word updated.');}catch(e){setError(e instanceof Error?e.message:'Invalid word.');}}
 return <section aria-labelledby="vocabulary-title" className="space-y-4">
 <div className="flex items-center justify-between gap-3"><h2 id="vocabulary-title" className="text-xl font-semibold">Vocabulary {words!==null&&<span className="opacity-60">· {words.length}</span>}</h2><button type="button" disabled={busy||translating} onClick={()=>setReload(n=>n+1)} className="rounded-lg border px-3 py-2">Reload</button></div>
 {error&&<p role="alert" className="rounded-lg border border-red-500 p-3">{error}</p>}{notice&&<p role="status" className="text-sm text-teal-600">{notice}</p>}
 <div className="flex items-center justify-between gap-2 text-sm"><span role="status">{syncStatus}</span><button type="button" onClick={exportLocal} disabled={words===null} className="rounded-lg border p-2">Export backup</button></div>
 <nav aria-label="Learning views" className="grid grid-cols-4 gap-2">{(['vocabulary','review','practice','profile'] as const).map(v=><button key={v} type="button" disabled={busy||translating} aria-pressed={view===v} onClick={()=>{stopSpeech();setView(v);}} className={'rounded-lg border p-2 capitalize '+(view===v?'bg-teal-700 text-white':'')}>{v}</button>)}</nav>
 {words===null?<p role="status">{error?'Vocabulary unavailable':'Loading vocabulary…'}</p>:view==='review'?<ReviewPanel key={reload} words={words} disabled={busy||blocked} save={async next=>{const changed=next.find((w,i)=>w.review!==words[i]?.review);const ok=await persist(next,'Review saved.');if(ok&&changed?.review)recordActivity(userId,'review',changed.review.interval>0);return ok;}}/>:view==='practice'?<PracticePanel key={reload} words={words} onActivity={correct=>recordActivity(userId,'practice',correct)}/>:view==='profile'?<Profile user={user} words={words}/>:<>
 <form onSubmit={translateInput} className="grid gap-3 rounded-xl border p-4" aria-busy={translating}><label className="grid gap-1 text-sm">Translate<textarea value={source} onChange={e=>setSource(e.target.value)} dir="auto" maxLength={500} required disabled={translating||busy||blocked} className="rounded-lg border p-3" placeholder="English / فارسی"/></label><p className="text-xs opacity-70">Online translation sends this text to external translation providers. Do not enter private information.</p><button disabled={translating||busy||blocked||!source.trim()} className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50">{translating?'Translating…':'Translate'}</button>{translating&&<div role="status" className="h-10 rounded-lg bg-current opacity-10 motion-safe:animate-pulse"><span className="sr-only">Translating</span></div>}</form>
 <form onSubmit={submit} className="grid gap-3 rounded-xl border p-4"><h3 className="font-medium">{editing===null?'Add word':'Edit word'}</h3><label className="grid gap-1 text-sm">English<input required value={en} onChange={e=>setEn(e.target.value)} disabled={busy||blocked||translating} className="rounded-lg border p-2"/></label><label className="grid gap-1 text-sm">Persian<input required lang="fa" dir="rtl" value={fa} onChange={e=>setFa(e.target.value)} disabled={busy||blocked} className="rounded-lg border p-2"/></label><div className="flex gap-2"><button disabled={busy||blocked} className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50">{busy?'Saving…':editing===null?'Add':'Save'}</button>{editing!==null&&<button type="button" disabled={busy} onClick={reset} className="rounded-lg border px-4 py-2">Cancel</button>}</div></form>
 <label className="grid gap-1 text-sm">Search vocabulary<input type="search" value={query} onChange={e=>setQuery(e.target.value)} className="rounded-lg border p-3" placeholder="English / فارسی"/></label>
 {searchWords(words,query).length===0?<p>{words.length===0?'No saved words.':'No matching words.'}</p>:<ul className="divide-y divide-current/10">{searchWords(words,query).map(({word,index})=><li key={index} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="flex items-center gap-2">{word.en}<button type="button" aria-label={"Pronounce "+word.en} onClick={()=>speakEnglish(word.en,setError)} className="rounded-lg border p-2"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m11 5-6 4H2v6h3l6 4V5Z"/><path d="M15 9a4 4 0 0 1 0 6"/><path d="M18 6a8 8 0 0 1 0 12"/></svg></button></span><span lang="fa" dir="rtl">{word.fa}</span><div className="flex gap-2">{deleting===index?<><button type="button" disabled={busy||blocked} onClick={()=>void persist(removeWord(words,index),'Word deleted.')} className="rounded-lg border border-red-500 px-2 py-1">Confirm delete</button><button type="button" disabled={busy} onClick={()=>setDeleting(null)} className="px-2">Cancel</button></>:<><button type="button" disabled={busy||blocked} onClick={()=>{setEditing(index);setEn(word.en);setFa(word.fa);setDeleting(null);}} className="rounded-lg border px-2 py-1">Edit</button><button type="button" disabled={busy||blocked} onClick={()=>setDeleting(index)} className="rounded-lg border px-2 py-1">Delete</button></>}</div></li>)}</ul>}
 </>}
 </section>;
}
