import {useEffect,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import type {Word} from '../../domain';
import {readWorkspace,writeWorkspace} from '../../services/workspace';
import {searchWords,saveWord,removeWord} from './model';

export function Vocabulary({userId}:{userId:string}){
 const [words,setWords]=useState<Word[]|null>(null);
 const [revision,setRevision]=useState<number|null>(null);
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
 useEffect(()=>{
   const current=++generation.current;
   setWords(null);setRevision(null);setError('');setBlocked(false);setBusy(false);locked.current=false;setEditing(null);setDeleting(null);setEn('');setFa('');setNotice('');
   readWorkspace(userId).then(result=>{if(generation.current===current){setWords(result?.words??[]);setRevision(result?.revision??null);}}).catch(()=>{if(generation.current===current)setError('Could not load vocabulary. Your data was not changed.');});
   return ()=>{generation.current++;};
 },[userId,reload]);
 function reset(){setEditing(null);setEn('');setFa('');}
 async function persist(next:Word[],success:string){
   if(locked.current||blocked||words===null)return;
   locked.current=true;setBusy(true);setError('');setNotice('');
   const current=generation.current;
   try{const rev=await writeWorkspace(userId,next,revision);if(generation.current===current){setWords(next);setRevision(rev);reset();setDeleting(null);setNotice(success);}}
   catch(e){if(generation.current===current){setBlocked(true);setError(e instanceof Error?e.message:'Save failed. Reload before retrying.');}}
   finally{if(generation.current===current){locked.current=false;setBusy(false);}}
 }
 function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(words===null||busy||blocked)return;try{void persist(saveWord(words,en,fa,editing),editing===null?'Word added.':'Word updated.');}catch(e){setError(e instanceof Error?e.message:'Invalid word.');}}
 return <section aria-labelledby="vocabulary-title" className="space-y-4">
 <div className="flex items-center justify-between gap-3"><h2 id="vocabulary-title" className="text-xl font-semibold">Vocabulary {words!==null&&<span className="opacity-60">· {words.length}</span>}</h2><button type="button" disabled={busy} onClick={()=>setReload(n=>n+1)} className="rounded-lg border px-3 py-2">Reload</button></div>
 {error&&<p role="alert" className="rounded-lg border border-red-500 p-3">{error}</p>}{notice&&<p role="status" className="text-sm text-teal-600">{notice}</p>}
 {words===null?<p role="status">{error?'Vocabulary unavailable':'Loading vocabulary…'}</p>:<>
 <form onSubmit={submit} className="grid gap-3 rounded-xl border p-4"><h3 className="font-medium">{editing===null?'Add word':'Edit word'}</h3><label className="grid gap-1 text-sm">English<input required value={en} onChange={e=>setEn(e.target.value)} disabled={busy||blocked} className="rounded-lg border p-2"/></label><label className="grid gap-1 text-sm">Persian<input required lang="fa" dir="rtl" value={fa} onChange={e=>setFa(e.target.value)} disabled={busy||blocked} className="rounded-lg border p-2"/></label><div className="flex gap-2"><button disabled={busy||blocked} className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50">{busy?'Saving…':editing===null?'Add':'Save'}</button>{editing!==null&&<button type="button" disabled={busy} onClick={reset} className="rounded-lg border px-4 py-2">Cancel</button>}</div></form>
 <label className="grid gap-1 text-sm">Search vocabulary<input type="search" value={query} onChange={e=>setQuery(e.target.value)} className="rounded-lg border p-3" placeholder="English / فارسی"/></label>
 {searchWords(words,query).length===0?<p>{words.length===0?'No saved words.':'No matching words.'}</p>:<ul className="divide-y divide-current/10">{searchWords(words,query).map(({word,index})=><li key={index} className="flex flex-wrap items-center justify-between gap-3 py-3"><span>{word.en}</span><span lang="fa" dir="rtl">{word.fa}</span><div className="flex gap-2">{deleting===index?<><button type="button" disabled={busy||blocked} onClick={()=>void persist(removeWord(words,index),'Word deleted.')} className="rounded-lg border border-red-500 px-2 py-1">Confirm delete</button><button type="button" disabled={busy} onClick={()=>setDeleting(null)} className="px-2">Cancel</button></>:<><button type="button" disabled={busy||blocked} onClick={()=>{setEditing(index);setEn(word.en);setFa(word.fa);setDeleting(null);}} className="rounded-lg border px-2 py-1">Edit</button><button type="button" disabled={busy||blocked} onClick={()=>setDeleting(index)} className="rounded-lg border px-2 py-1">Delete</button></>}</div></li>)}</ul>}
 </>}
 </section>;
}
