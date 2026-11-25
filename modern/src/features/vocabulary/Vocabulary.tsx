import {useEffect,useRef,useState} from 'react';
import {motion} from 'motion/react';
import {BookOpen,RefreshCw,Brain,UserRound,Download,Cloud,Volume2,Pencil,Trash2,Languages,Search,Settings,Check,ChevronLeft,ChevronRight,Copy,Plus,Sun,Moon,Monitor,LogOut} from 'lucide-react';
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

export function Vocabulary({userId,user,theme,setTheme,signOut}:{userId:string;user:User;theme:'system'|'light'|'dark';setTheme:(theme:'system'|'light'|'dark')=>void;signOut:()=>Promise<void>}){
 const [view,setView]=useState<'vocabulary'|'learn'|'profile'|'settings'>('vocabulary');
 const [railHover,setRailHover]=useState(false);
 const [collapsed,setCollapsed]=useState(()=>{try{return localStorage.getItem('wf-sidebar-collapsed')==='1';}catch{return false;}});
 useEffect(()=>{try{localStorage.setItem('wf-sidebar-collapsed',collapsed?'1':'0');}catch{}},[collapsed]);
 const [learnMode,setLearnMode]=useState<'review'|'practice'|'cards'>('review');
 const [words,setWords]=useState<Word[]|null>(null);
 const snapshot=useRef<Snapshot|null>(null);
 const [syncStatus,setSyncStatus]=useState('Loading');
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState<'active'|'kept'>('active');
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
  event.preventDefault();if(translationRequest.current||!source.trim())return;
  translationRequest.current?.abort();const controller=new AbortController();translationRequest.current=controller;setTranslating(true);setError('');setNotice('');
  const text=source.trim(),language=detectLanguage(text);
  try{const result=await translate(text,language,language==='en'?'fa':'en',controller.signal);if(controller.signal.aborted)return;setEditing(null);setDeleting(null);setEn(language==='en'?text:result);setFa(language==='fa'?text:result);setNotice('');}
  catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Translation failed.');}
  finally{if(translationRequest.current===controller){translationRequest.current=null;setTranslating(false);}}
 }
 useEffect(()=>{
   const current=++generation.current;
   setWords(null);snapshot.current=null;setError('');setBlocked(false);setBusy(false);locked.current=false;setEditing(null);setDeleting(null);setEn('');setFa('');setNotice('');
   openWorkspace(userId).then(result=>{if(generation.current===current){snapshot.current=result;setWords(result.words);setSyncStatus(result.dirty?'Pending sync':'Saved locally');}}).catch(()=>{if(generation.current===current)setError('Could not load vocabulary. Your data was not changed.');});
   return ()=>{generation.current++;};
 },[userId,reload]);
 function reset(){setEditing(null);setEn('');setFa('');}
 async function copy(text:string){try{await navigator.clipboard.writeText(text);setNotice('Copied.');}catch{setError('Could not copy.');}}
 useEffect(()=>{if(!notice)return;const t=window.setTimeout(()=>setNotice(''),2200);return()=>window.clearTimeout(t);},[notice]);
 async function persist(next:Word[],success:string):Promise<boolean>{
   if(locked.current||blocked||words===null)return false;
   locked.current=true;setBusy(true);setError('');setNotice('');
   const current=generation.current;
   try{const previous=snapshot.current;if(!previous)throw Error('Workspace unavailable');const local=makeSnapshot(userId,next,previous.revision,true);await storeLocal(local,previous.version);if(generation.current!==current)return false;snapshot.current=local;setWords(next);setSyncStatus('Pending sync');if(!translationRequest.current)reset();setDeleting(null);setNotice(success+' Saved on this device.');return true;}
   catch(e){if(generation.current===current){setBlocked(true);setError(e instanceof Error?e.message:'Save failed. Reload before retrying.');}return false;}
   finally{if(generation.current===current){locked.current=false;setBusy(false);}}
 }
 useEffect(()=>{let active=true;async function flush(){const local=snapshot.current;if(!active||!local?.dirty||locked.current||!navigator.onLine)return;locked.current=true;setBusy(true);setSyncStatus('Syncing');try{const clean=await syncLocal(local);if(active&&snapshot.current?.version===local.version){snapshot.current=clean;setSyncStatus('Synced');}}catch(e){if(active){setSyncStatus('Pending sync');setError(e instanceof Error?e.message:'Cloud sync unavailable. Local changes preserved.');}}finally{if(active){locked.current=false;setBusy(false);}}}const timer=window.setInterval(()=>void flush(),15000);window.addEventListener('online',flush);void flush();return()=>{active=false;window.clearInterval(timer);window.removeEventListener('online',flush);};},[userId,reload]);
 function exportLocal(){const local=snapshot.current;if(!local)return;const url=URL.createObjectURL(new Blob([JSON.stringify({words:local.words,revision:local.revision},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='wordflow-local-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(words===null||busy||blocked||translating)return;try{void persist(saveWord(words,en,fa,editing),editing===null?'Word added.':'Word updated.');}catch(e){setError(e instanceof Error?e.message:'Invalid word.');}}
 const nav=[{id:'vocabulary',label:'Vocabulary',Icon:BookOpen},{id:'learn',label:'Learn',Icon:Brain},{id:'profile',label:'Profile',Icon:UserRound},{id:'settings',label:'Settings',Icon:Settings}] as const;
 const stats=metrics(words??[]);
 const cards=(words??[]).filter(w=>!w.kept);const currentCard=cards[Math.min(cardIndex,Math.max(0,cards.length-1))];
 const filtered=searchWords(words??[],query).filter(({word})=>filter==='kept'?word.kept:!word.kept);
 const pageRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{pageRef.current?.scrollTo({top:0});},[view]);
 return <div className="wf-workspace" data-sidebar-collapsed={collapsed&&!railHover} data-sidebar-pinned={ !collapsed }>
 <nav aria-label="Learning views" className="wf-sidebar" id="wf-navigation" onPointerEnter={e=>{if(e.pointerType==='mouse'&&window.matchMedia('(hover:hover) and (min-width:761px)').matches)setRailHover(true);}} onPointerLeave={()=>setRailHover(false)}><div className="wf-sidebar-top"><span className="wf-sidebar-title">Workspace</span><button type="button" className="wf-sidebar-toggle" aria-label={collapsed?"Expand navigation":"Collapse navigation"} aria-expanded={!collapsed} title={collapsed?"Expand navigation":"Collapse navigation"} onClick={()=>{setRailHover(false);setCollapsed(v=>!v);}}>{collapsed?<ChevronRight size={16}/>:<ChevronLeft size={16}/>}</button></div>{nav.map(({id,label,Icon})=><button key={id} type="button" aria-label={label} title={label} aria-current={view===id?'page':undefined} onClick={()=>{stopSpeech();setView(id);}} className="wf-nav-button">{view===id&&<motion.span layoutId="wf-active-tab" className="wf-nav-active" transition={{type:'spring',stiffness:400,damping:35}}/>}<Icon size={20}/><span className="wf-nav-label">{label}</span></button>)}</nav>
 <section className="wf-main" aria-labelledby="workspace-title">
 <div className="wf-toolbar"><div><h2 id="workspace-title">{nav.find(n=>n.id===view)?.label}</h2><span role="status" className="wf-status"><Cloud size={14}/>{syncStatus}</span></div></div>
 <div className="wf-workspace-feedback" aria-live="polite">{(error||notice)&&<motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}}><div className="flex items-start gap-3"><p className={error?"text-red-600":"text-[var(--accent)]"}>{error||notice}</p><button type="button" aria-label="Dismiss message" className="ml-auto" onClick={()=>{setError('');setNotice('');}}>×</button></div></motion.div>}</div>
 <motion.div ref={pageRef} key={view} className="wf-page" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:.18}}>
 {words===null&&view!=='vocabulary'?<p role="status">{error?'Vocabulary unavailable':'Loading vocabulary…'}</p>:view==='learn'?<><div className="wf-learn-overview"><div><strong>{stats.due}</strong><span>Due for review</span></div><div><strong>{stats.words}</strong><span>Saved words</span></div><div><strong>{stats.reviewed}</strong><span>Reviewed</span></div></div><div className="wf-segments" aria-label="Learning mode">{(['review','practice','cards'] as const).map(mode=><button key={mode} aria-pressed={learnMode===mode} onClick={()=>{stopSpeech();setLearnMode(mode);setCardIndex(0);setCardReveal(false);}}>{mode==='review'?'Review':mode==='practice'?'Practice':'Flashcards'}</button>)}</div><motion.div key={learnMode} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:.15}}>{learnMode==='review'?<ReviewPanel key={reload} words={words??[]} disabled={busy||blocked} save={async next=>{const changed=next.find((w,i)=>w.review!==words?.[i]?.review);const ok=await persist(next,'Review saved.');if(ok&&changed?.review)recordActivity(userId,'review',changed.review.interval>0);return ok;}}/>:learnMode==='practice'?<PracticePanel key={reload} words={words} onActivity={correct=>recordActivity(userId,'practice',correct)}/>:<div className="wf-panel"><div className="grid gap-3">{currentCard?<><p className="text-center text-sm">{Math.min(cardIndex+1,cards.length)} / {cards.length}</p><motion.button key={currentCard.timestamp+String(cardReveal)} type="button" className="wf-study-card" initial={{opacity:0,scale:.98}} animate={{opacity:1,scale:1}} onClick={()=>setCardReveal(v=>!v)}><strong className="text-3xl" dir="auto">{cardReveal?currentCard.fa:currentCard.en}</strong><span className="text-xs opacity-70">{cardReveal?"Tap to hide":"Tap to reveal"}</span></motion.button><div className="flex justify-center gap-2"><button className="wf-action" aria-label="Previous card" disabled={cardIndex===0} onClick={()=>{setCardIndex(i=>Math.max(0,i-1));setCardReveal(false);}}><ChevronLeft size={18}/></button><button className="wf-action" aria-label="Pronounce card" onClick={()=>speakEnglish(currentCard.en,setError)}><Volume2 size={18}/></button><button className="wf-action" aria-label="Next card" disabled={cardIndex>=cards.length-1} onClick={()=>{setCardIndex(i=>i+1);setCardReveal(false);}}><ChevronRight size={18}/></button></div></>:<p className="wf-empty">No active cards.</p>}</div></div>}</motion.div></>: view==='profile'?<Profile user={user} words={words}/>:view==='settings'?<div className="wf-panel grid gap-4"><h3 className="font-semibold">Appearance</h3><div className="wf-segments">{([{value:"light",Icon:Sun},{value:"dark",Icon:Moon},{value:"system",Icon:Monitor}] as const).map(({value,Icon})=><button key={value} aria-pressed={theme===value} onClick={()=>setTheme(value)}><Icon size={16}/>{value}</button>)}</div><h3 className="font-semibold">Data & account</h3><p className="text-sm">Export your local vocabulary before changing devices.</p><div className="flex flex-wrap gap-2"><button className="wf-action" onClick={exportLocal}><Download size={16}/>Export backup</button><button className="wf-action" disabled={busy||translating} onClick={()=>setReload(n=>n+1)}><RefreshCw size={16}/>Reload workspace</button></div><button className="wf-action justify-self-start" onClick={()=>setView('profile')}><UserRound size={16}/>Profile & security</button><button className="wf-action justify-self-start" onClick={()=>void signOut()}><LogOut size={16}/>Sign out</button></div>:<>
 <section className="wf-panel wf-translator"><div className="wf-translate-label"><Languages size={16}/><span>English ↔ فارسی</span><span className="wf-auto-label">Auto detect</span></div><form onSubmit={translateInput} className="wf-translate-form"><input id="wf-source" dir="auto" aria-label="Word or phrase to translate" value={source} onChange={e=>setSource(e.target.value)} maxLength={500} required placeholder="Type a word or phrase…" disabled={translating}/><button className="wf-primary" disabled={translating||!source.trim()}>{translating?'Translating…':'Translate'}</button></form><p className="wf-privacy-hint">Online translation · text is sent to translation providers.</p><div className="wf-translation-result" aria-busy={translating}>{translating?<div className="wf-result-skeleton motion-safe:animate-pulse" role="status" aria-label="Translating"/>:en||fa||editing!==null?<motion.form initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:.15}} onSubmit={submit} className="wf-result-form"><div className="wf-result-fields"><label>English<input value={en} onChange={e=>setEn(e.target.value)} required dir="ltr"/></label><label>فارسی<input value={fa} onChange={e=>setFa(e.target.value)} required dir="rtl" lang="fa"/></label></div><div className="wf-result-actions"><button type="button" className="wf-action" title="Pronounce English" aria-label="Pronounce English" onClick={()=>speakEnglish(en,setError)}><Volume2 size={18}/></button><button type="button" className="wf-action" aria-label="Copy translation" onClick={()=>void copy(en+' — '+fa)}><Copy size={16}/></button><button className="wf-primary" disabled={words===null||busy||blocked||!en.trim()||!fa.trim()}><Plus size={16}/>{editing===null?'Save word':'Save changes'}</button></div></motion.form>:<div className="wf-result-placeholder">Translation appears here.<button type="button" className="wf-action" onClick={()=>{setEn(source);setFa('');setEditing(null);if(!source)setEn(' ');}}>Add manually</button></div>}</div></section><div className="wf-panel"><div className="wf-library-heading"><strong>My vocabulary <small>{words?.length??0}</small></strong><div className="wf-segments">{(['active','kept'] as const).map(id=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{id==='active'?'Active':'Kept'}</button>)}</div></div><label className="grid gap-1 text-sm"><span className="flex items-center gap-2"><Search size={16}/>Search vocabulary</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} className="rounded-lg border p-3" placeholder="English / فارسی"/></label>
 {filtered.length===0?<p>{words===null?'Loading vocabulary…':words.length===0?'No saved words.':'No matching words.'}</p>:<ul className="wf-word-list">{filtered.map(({word,index})=><li key={index} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="flex items-center gap-2">{word.en}<button type="button" aria-label={"Pronounce "+word.en} onClick={()=>speakEnglish(word.en,setError)} className="rounded-lg border p-2"><Volume2 size={18}/></button></span><span lang="fa" dir="rtl">{word.fa}</span><div className="flex gap-2">{deleting===index?<><button type="button" disabled={busy||blocked} onClick={()=>void persist(removeWord(words??[],index),'Word deleted.')} className="rounded-lg border border-red-500 px-2 py-1">Confirm delete</button><button type="button" disabled={busy} onClick={()=>setDeleting(null)} className="px-2">Cancel</button></>:<><button type="button" disabled={busy||blocked} onClick={()=>{setEditing(index);setEn(word.en);setFa(word.fa);setDeleting(null);pageRef.current?.scrollTo({top:0,behavior:'auto'});}} className="wf-action" aria-label="Edit word"><Pencil size={16}/></button><button type="button" className="wf-action" aria-label="Copy word" onClick={()=>void copy(word.en+" — "+word.fa)}><Copy size={16}/></button><button type="button" className="wf-action" disabled={busy||blocked} aria-label={word.kept?"Return to active":"Keep word"} onClick={()=>void persist((words??[]).map((w,i)=>i===index?{...w,kept:!w.kept}:w),word.kept?"Word returned.":"Word kept.")}><Check size={16}/></button><button type="button" disabled={busy||blocked} onClick={()=>setDeleting(index)} className="wf-action" aria-label="Delete word"><Trash2 size={16}/></button></>}</div></li>)}</ul>}
 </div></>}
 </motion.div></section></div>;
}
