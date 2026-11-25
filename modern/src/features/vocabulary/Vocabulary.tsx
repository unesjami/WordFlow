import {useEffect,useRef,useState} from 'react';
import {motion} from 'motion/react';
import {House,BookOpen,RefreshCw,Brain,UserRound,Download,Cloud,Volume2,Pencil,Trash2,Languages,Search,ArrowRight,Settings,Check,ChevronLeft,ChevronRight} from 'lucide-react';
import {metrics} from '../profile/analytics';
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
 const [view,setView]=useState<'today'|'vocabulary'|'review'|'practice'|'profile'|'settings'>('today');
 const [words,setWords]=useState<Word[]|null>(null);
 const snapshot=useRef<Snapshot|null>(null);
 const [syncStatus,setSyncStatus]=useState('Loading');
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState<'active'|'kept'|'cards'>('active');
 const [cardIndex,setCardIndex]=useState(0);
 const [cardReveal,setCardReveal]=useState(false);
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
 const nav=[{id:'today',label:'Today',Icon:House},{id:'vocabulary',label:'Vocabulary',Icon:BookOpen},{id:'review',label:'Review',Icon:RefreshCw},{id:'practice',label:'Practice',Icon:Brain},{id:'profile',label:'Profile',Icon:UserRound},{id:'settings',label:'Settings',Icon:Settings}] as const;
 const stats=metrics(words??[]);
 const cards=(words??[]).filter(w=>!w.kept);const currentCard=cards[Math.min(cardIndex,Math.max(0,cards.length-1))];
 const filtered=searchWords(words??[],query).filter(({word})=>filter==='kept'?word.kept:!word.kept);
 const pageRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{pageRef.current?.scrollTo({top:0});},[view]);
 return <div className="wf-workspace">
 <nav aria-label="Learning views" className="wf-sidebar">{nav.map(({id,label,Icon})=><button key={id} type="button" disabled={busy||translating} aria-current={view===id?'page':undefined} onClick={()=>{stopSpeech();setView(id);}} className="wf-nav-button">{view===id&&<motion.span layoutId="wf-active-tab" className="wf-nav-active" transition={{type:'spring',stiffness:400,damping:35}}/>}<Icon size={20}/><span>{label}</span></button>)}</nav>
 <section className="wf-main" aria-labelledby="workspace-title">
 <div className="wf-toolbar"><div><h2 id="workspace-title">{nav.find(n=>n.id===view)?.label}</h2><span role="status" className="wf-status"><Cloud size={14}/>{syncStatus}</span></div><div className="flex gap-2"><button type="button" aria-label="Reload workspace" disabled={busy||translating} onClick={()=>setReload(n=>n+1)} className="wf-action"><RefreshCw size={16}/></button><button type="button" onClick={exportLocal} disabled={words===null} className="wf-action"><Download size={16}/>Export</button></div></div>
 <div className="wf-workspace-feedback" aria-live="polite">{(error||notice)&&<motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}}><div className="flex items-start gap-3"><p className={error?"text-red-600":"text-[var(--accent)]"}>{error||notice}</p><button type="button" aria-label="Dismiss message" className="ml-auto" onClick={()=>{setError('');setNotice('');}}>×</button></div></motion.div>}</div>
 <motion.div ref={pageRef} key={view} className="wf-page" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:.18}}>
 {words===null?<p role="status">{error?'Vocabulary unavailable':'Loading vocabulary…'}</p>:view==='today'?<><div className="wf-hero"><h3>Turn new words into lasting knowledge.</h3><div className="wf-learning-path">{['Translate','Save','Review'].map((label,i)=><div className="wf-path-step" key={label}><span className="wf-step-number">{i+1}</span><div><strong>{label}</strong><small>{['Find the meaning','Build your collection','Remember what you learn'][i]}</small></div></div>)}</div></div><div className="wf-metrics">{[{label:'Vocabulary',value:stats.words,Icon:BookOpen},{label:'Due for review',value:stats.due,Icon:RefreshCw},{label:'Reviewed',value:stats.reviewed,Icon:Brain}].map(({label,value,Icon})=><div key={label} className="wf-metric"><Icon size={21}/><strong>{value}</strong><span>{label}</span></div>)}</div><div className="wf-panel grid gap-4"><h3 className="text-lg font-semibold">Your vocabulary workspace</h3><div className="grid gap-2 sm:grid-cols-2"><button className="wf-primary" onClick={()=>setView('vocabulary')}><Languages size={18}/>Translate a word<ArrowRight size={16}/></button><button className="wf-action" onClick={()=>setView('review')}><RefreshCw size={18}/>Review words</button></div></div><div className="wf-panel"><h3 className="mb-3 font-semibold">Recent vocabulary</h3>{words.length===0?<p className="wf-empty">No saved words yet.</p>:<ul className="wf-word-list">{[...words].sort((a,b)=>b.timestamp-a.timestamp).slice(0,5).map((w,i)=><li key={i} className="flex items-center justify-between gap-3"><span className="font-medium">{w.en}</span><span lang="fa" dir="rtl">{w.fa}</span></li>)}</ul>}</div></>:view==='review'?<ReviewPanel key={reload} words={words} disabled={busy||blocked} save={async next=>{const changed=next.find((w,i)=>w.review!==words[i]?.review);const ok=await persist(next,'Review saved.');if(ok&&changed?.review)recordActivity(userId,'review',changed.review.interval>0);return ok;}}/>:view==='practice'?<PracticePanel key={reload} words={words} onActivity={correct=>recordActivity(userId,'practice',correct)}/>:view==='profile'?<Profile user={user} words={words}/>:view==='settings'?<div className="wf-panel grid gap-4"><h3 className="font-semibold">Data & account</h3><p className="text-sm">Export your local vocabulary before changing devices.</p><div className="flex flex-wrap gap-2"><button className="wf-action" onClick={exportLocal}><Download size={16}/>Export backup</button><button className="wf-action" disabled={busy||translating} onClick={()=>setReload(n=>n+1)}><RefreshCw size={16}/>Reload workspace</button></div><button className="wf-action justify-self-start" onClick={()=>setView('profile')}><UserRound size={16}/>Profile & security</button></div>:<>
 <div className="wf-capture-grid"><form onSubmit={translateInput} className="wf-panel grid gap-3" aria-busy={translating}><label className="grid gap-1 text-sm">Translate<textarea value={source} onChange={e=>setSource(e.target.value)} dir="auto" maxLength={500} required disabled={translating||busy||blocked} className="rounded-lg border p-3" placeholder="English / فارسی"/></label><p className="text-xs opacity-70">Online translation sends this text to external translation providers. Do not enter private information.</p><button disabled={translating||busy||blocked||!source.trim()} className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50">{translating?'Translating…':'Translate'}</button>{translating&&<div role="status" className="h-10 rounded-lg bg-current opacity-10 motion-safe:animate-pulse"><span className="sr-only">Translating</span></div>}</form>
 <form onSubmit={submit} className="wf-panel grid gap-3"><h3 className="font-medium">{editing===null?'Add word':'Edit word'}</h3><label className="grid gap-1 text-sm">English<input required value={en} onChange={e=>setEn(e.target.value)} disabled={busy||blocked||translating} className="rounded-lg border p-2"/></label><label className="grid gap-1 text-sm">Persian<input required lang="fa" dir="rtl" value={fa} onChange={e=>setFa(e.target.value)} disabled={busy||blocked} className="rounded-lg border p-2"/></label><div className="flex gap-2"><button disabled={busy||blocked} className="rounded-lg bg-teal-700 px-4 py-2 text-white disabled:opacity-50">{busy?'Saving…':editing===null?'Add':'Save'}</button>{editing!==null&&<button type="button" disabled={busy} onClick={reset} className="rounded-lg border px-4 py-2">Cancel</button>}</div></form>
 </div><div className="wf-panel"><div className="grid grid-cols-3 gap-1 rounded-xl border p-1 mb-4">{([["active","Active"],["kept","Kept"],["cards","Cards"]] as const).map(([id,label])=><button key={id} type="button" aria-pressed={filter===id} onClick={()=>{setFilter(id);setCardIndex(0);setCardReveal(false);}} className={"rounded-lg px-2 py-2 text-sm "+(filter===id?"bg-teal-700 text-white":"")}>{label}</button>)}</div>{filter==='cards'?<div className="grid gap-3">{currentCard?<><p className="text-center text-sm">{Math.min(cardIndex+1,cards.length)} / {cards.length}</p><motion.button key={currentCard.timestamp+String(cardReveal)} type="button" className="wf-study-card" initial={{opacity:0,scale:.98}} animate={{opacity:1,scale:1}} onClick={()=>setCardReveal(v=>!v)}><strong className="text-3xl" dir="auto">{cardReveal?currentCard.fa:currentCard.en}</strong><span className="text-xs opacity-70">{cardReveal?"Tap to hide":"Tap to reveal"}</span></motion.button><div className="flex justify-center gap-2"><button className="wf-action" aria-label="Previous card" disabled={cardIndex===0} onClick={()=>{setCardIndex(i=>Math.max(0,i-1));setCardReveal(false);}}><ChevronLeft size={18}/></button><button className="wf-action" aria-label="Pronounce card" onClick={()=>speakEnglish(currentCard.en,setError)}><Volume2 size={18}/></button><button className="wf-action" aria-label="Next card" disabled={cardIndex>=cards.length-1} onClick={()=>{setCardIndex(i=>i+1);setCardReveal(false);}}><ChevronRight size={18}/></button></div></>:<p className="wf-empty">No active cards.</p>}</div>:<><label className="grid gap-1 text-sm"><span className="flex items-center gap-2"><Search size={16}/>Search vocabulary</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} className="rounded-lg border p-3" placeholder="English / فارسی"/></label>
 {filtered.length===0?<p>{words.length===0?'No saved words.':'No matching words.'}</p>:<ul className="wf-word-list">{filtered.map(({word,index})=><li key={index} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="flex items-center gap-2">{word.en}<button type="button" aria-label={"Pronounce "+word.en} onClick={()=>speakEnglish(word.en,setError)} className="rounded-lg border p-2"><Volume2 size={18}/></button></span><span lang="fa" dir="rtl">{word.fa}</span><div className="flex gap-2">{deleting===index?<><button type="button" disabled={busy||blocked} onClick={()=>void persist(removeWord(words,index),'Word deleted.')} className="rounded-lg border border-red-500 px-2 py-1">Confirm delete</button><button type="button" disabled={busy} onClick={()=>setDeleting(null)} className="px-2">Cancel</button></>:<><button type="button" disabled={busy||blocked} onClick={()=>{setEditing(index);setEn(word.en);setFa(word.fa);setDeleting(null);}} className="wf-action" aria-label="Edit word"><Pencil size={16}/></button><button type="button" className="wf-action" disabled={busy||blocked} aria-label={word.kept?"Return to active":"Keep word"} onClick={()=>void persist(words.map((w,i)=>i===index?{...w,kept:!w.kept}:w),word.kept?"Word returned.":"Word kept.")}><Check size={16}/></button><button type="button" disabled={busy||blocked} onClick={()=>setDeleting(index)} className="wf-action" aria-label="Delete word"><Trash2 size={16}/></button></>}</div></li>)}</ul>}
 </>}</div></>}
 </motion.div></section></div>;
}
