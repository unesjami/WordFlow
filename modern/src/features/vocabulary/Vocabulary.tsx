import {useEffect,useRef,useState} from 'react';
import {motion} from 'motion/react';
import {BookOpen,RefreshCw,Brain,UserRound,Download,Cloud,Pencil,Trash2,Settings,Check,ChevronLeft,ChevronRight,Copy,Sun,Moon,Monitor,LogOut,ShieldCheck,X} from 'lucide-react';
import {metrics} from '../profile/analytics';
import type {FormEvent} from 'react';
import type {Word} from '../../domain';
import type {User} from '@supabase/supabase-js';
import {Profile} from '../profile/Profile';
import {recordActivity} from '../profile/analytics';
import {openWorkspace,storeLocal,makeSnapshot,syncLocal} from '../../services/offline';
import type {Snapshot} from '../../services/offline';
import {saveWord,removeWord} from './model';
import {translate,detectLanguage} from '../../services/translation';
import {stopSpeech} from '../../services/speech';
import {ReviewPanel} from '../learning/ReviewPanel';
import {PronounceButton} from '../learning/PronounceButton';
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
  event.preventDefault();if(translationRequest.current||locked.current||blocked||!snapshot.current||!source.trim())return;
  const controller=new AbortController();translationRequest.current=controller;setTranslating(true);setError('');setNotice('');
  const text=source.trim(),language=detectLanguage(text),current=generation.current;
  try{
   const result=await translate(text,language,language==='en'?'fa':'en',controller.signal);
   if(controller.signal.aborted||generation.current!==current)return;
   const latest=snapshot.current;if(!latest)throw Error('Vocabulary unavailable. Reload and retry.');
   const next=saveWord(latest.words,language==='en'?text:result,language==='fa'?text:result);
   if(await persist(next,'Word added.')){
    setSource('');reset();setFilter('active');
   }
  }
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
   if(locked.current||blocked||!snapshot.current)return false;
   locked.current=true;setBusy(true);setError('');setNotice('');
   const current=generation.current;
   try{const previous=snapshot.current;if(!previous)throw Error('Workspace unavailable');const local=makeSnapshot(userId,next,previous.revision,true);await storeLocal(local,previous.version);if(generation.current!==current)return false;snapshot.current=local;setWords(next);setSyncStatus('Pending sync');if(!translationRequest.current)reset();setDeleting(null);setNotice(success);return true;}
   catch(e){if(generation.current===current){setBlocked(true);setError(e instanceof Error?e.message:'Save failed. Reload before retrying.');}return false;}
   finally{if(generation.current===current){locked.current=false;setBusy(false);}}
 }
 useEffect(()=>{let active=true;async function flush(){const local=snapshot.current;if(!active||!local?.dirty||locked.current||translationRequest.current||!navigator.onLine)return;locked.current=true;setBusy(true);setSyncStatus('Syncing');try{const clean=await syncLocal(local);if(active&&snapshot.current?.version===local.version){snapshot.current=clean;setSyncStatus('Synced');}}catch(e){if(active){setSyncStatus('Pending sync');setError(e instanceof Error?e.message:'Cloud sync unavailable. Local changes preserved.');}}finally{if(active){locked.current=false;setBusy(false);}}}const timer=window.setInterval(()=>void flush(),15000);window.addEventListener('online',flush);void flush();return()=>{active=false;window.clearInterval(timer);window.removeEventListener('online',flush);};},[userId,reload]);
 function exportLocal(){const local=snapshot.current;if(!local)return;const url=URL.createObjectURL(new Blob([JSON.stringify({words:local.words,revision:local.revision},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='wordflow-local-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();if(words===null||busy||blocked||translating)return;try{void persist(saveWord(words,en,fa,editing),editing===null?'Word added.':'Word updated.');}catch(e){setError(e instanceof Error?e.message:'Invalid word.');}}
 const nav=[{id:'vocabulary',label:'Vocabulary',Icon:BookOpen},{id:'learn',label:'Learn',Icon:Brain},{id:'profile',label:'Profile',Icon:UserRound},{id:'settings',label:'Settings',Icon:Settings}] as const;
 const stats=metrics(words??[]);
 const cards=(words??[]).filter(w=>!w.kept);const currentCard=cards[Math.min(cardIndex,Math.max(0,cards.length-1))];
 const filtered=(words??[]).map((word,index)=>({word,index})).filter(({word})=>filter==='kept'?word.kept:!word.kept).sort((a,b)=>b.word.timestamp-a.word.timestamp);
 const pageRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{pageRef.current?.scrollTo({top:0});},[view]);
 return <div className="wf-workspace" data-sidebar-collapsed={collapsed&&!railHover} data-sidebar-pinned={ !collapsed }>
 <nav aria-label="Learning views" className="wf-sidebar" id="wf-navigation" onPointerEnter={e=>{if(e.pointerType==='mouse'&&window.matchMedia('(hover:hover) and (min-width:761px)').matches)setRailHover(true);}} onPointerLeave={()=>setRailHover(false)}><div className="wf-sidebar-top"><span className="wf-sidebar-title">Workspace</span><button type="button" className="wf-sidebar-toggle" aria-label={collapsed?"Expand navigation":"Collapse navigation"} aria-expanded={!collapsed} title={collapsed?"Expand navigation":"Collapse navigation"} onClick={()=>{setRailHover(false);setCollapsed(v=>!v);}}>{collapsed?<ChevronRight size={16}/>:<ChevronLeft size={16}/>}</button></div>{nav.map(({id,label,Icon})=><button key={id} type="button" aria-label={label} title={label} aria-current={view===id?'page':undefined} onClick={()=>{stopSpeech();setView(id);}} className="wf-nav-button">{view===id&&<motion.span layoutId="wf-active-tab" className="wf-nav-active" transition={{type:'spring',stiffness:400,damping:35}}/>}<Icon size={20}/><span className="wf-nav-label">{label}</span></button>)}</nav>
 <section className="wf-main" aria-labelledby="workspace-title">
 <div className="wf-toolbar"><div><h2 id="workspace-title">{nav.find(n=>n.id===view)?.label}</h2></div></div>
 <div className="wf-workspace-feedback" aria-live="polite">{(error||notice)&&<motion.div initial={{opacity:0,y:-4}} animate={{opacity:1,y:0}}><div className="flex items-start gap-3"><p className={error?"text-red-600":"text-[var(--accent)]"}>{error||notice}</p><button type="button" aria-label="Dismiss message" className="ml-auto" onClick={()=>{setError('');setNotice('');}}><X size={16}/></button></div></motion.div>}</div>
 <motion.div ref={pageRef} key={view} className="wf-page" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:.18}}>
 {words===null&&(view==='learn'||view==='profile')?<p role="status">{error?'Vocabulary unavailable':'Loading vocabulary…'}</p>:view==='learn'?<><div className="wf-learn-overview"><div><strong>{stats.due}</strong><span>Due for review</span></div><div><strong>{stats.words}</strong><span>Saved words</span></div><div><strong>{stats.reviewed}</strong><span>Reviewed</span></div></div><div className="wf-segments" aria-label="Learning mode">{(['review','practice','cards'] as const).map(mode=><button key={mode} aria-pressed={learnMode===mode} onClick={()=>{stopSpeech();setLearnMode(mode);setCardIndex(0);setCardReveal(false);}}>{mode==='review'?'Review':mode==='practice'?'Practice':'Flashcards'}</button>)}</div><motion.div key={learnMode} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:.15}}>{learnMode==='review'?<ReviewPanel key={reload} words={words??[]} disabled={busy||blocked||translating} save={async next=>{if(translationRequest.current)return false;const changed=next.find((w,i)=>w.review!==words?.[i]?.review);const ok=await persist(next,'Review saved.');if(ok&&changed?.review)recordActivity(userId,'review',changed.review.interval>0);return ok;}}/>:learnMode==='practice'?<PracticePanel key={reload} words={words??[]} onActivity={correct=>recordActivity(userId,'practice',correct)}/>:<div className="wf-panel"><div className="grid gap-3">{currentCard?<><p className="text-center text-sm">{Math.min(cardIndex+1,cards.length)} / {cards.length}</p><motion.button key={currentCard.timestamp+String(cardReveal)} type="button" className="wf-study-card" initial={{opacity:0,scale:.98}} animate={{opacity:1,scale:1}} onClick={()=>setCardReveal(v=>!v)}><strong className="text-3xl" dir="auto">{cardReveal?currentCard.fa:currentCard.en}</strong><span className="text-xs opacity-70">{cardReveal?"Tap to hide":"Tap to reveal"}</span></motion.button><div className="flex justify-center gap-2"><button className="wf-action" aria-label="Previous card" disabled={cardIndex===0} onClick={()=>{setCardIndex(i=>Math.max(0,i-1));setCardReveal(false);}}><ChevronLeft size={18}/></button><PronounceButton text={currentCard.en} onError={setError} label="Pronounce card"/><button className="wf-action" aria-label="Next card" disabled={cardIndex>=cards.length-1} onClick={()=>{setCardIndex(i=>i+1);setCardReveal(false);}}><ChevronRight size={18}/></button></div></>:<p className="wf-empty">No active cards.</p>}</div></div>}</motion.div></>: view==='profile'?<Profile user={user} words={words??[]}/>:view==='settings'?<div className="wf-settings-grid">
 <motion.section className="wf-setting-card" initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} transition={{duration:.18}}>
 <header className="wf-setting-head"><span className="wf-setting-mark" data-tone="amber"><Sun size={25}/></span><div><h3>App preferences</h3></div></header>
 <div className="wf-setting-row"><span className="wf-setting-symbol"><Monitor size={21}/></span><div className="wf-setting-copy"><strong>Appearance</strong></div><div className="wf-theme-compact" role="group" aria-label="Appearance">{([{value:"light",Icon:Sun,label:"Light"},{value:"dark",Icon:Moon,label:"Dark"},{value:"system",Icon:Monitor,label:"Device"}] as const).map(({value,Icon,label})=><button key={value} type="button" title={label} aria-label={label} aria-pressed={theme===value} onClick={()=>setTheme(value)}>{theme===value&&<motion.span layoutId="wf-settings-theme-thumb" className="wf-theme-thumb" transition={{type:'spring',stiffness:450,damping:38}}/>}<Icon size={17}/></button>)}</div></div>
 <div className="wf-setting-row"><span className="wf-setting-symbol"><Settings size={21}/></span><div className="wf-setting-copy"><strong>Compact navigation</strong></div><button type="button" role="switch" aria-checked={collapsed} aria-label="Compact navigation" className="wf-setting-switch" onClick={()=>{setRailHover(false);setCollapsed(v=>!v);}}><span/></button></div>
 </motion.section>
 <motion.section className="wf-setting-card" initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} transition={{duration:.18,delay:.03}}>
 <header className="wf-setting-head"><span className="wf-setting-mark" data-tone="teal"><BookOpen size={25}/></span><div><h3>Data & sync</h3></div></header>
 <div className="wf-setting-row"><span className="wf-setting-symbol"><Cloud size={21}/></span><div className="wf-setting-copy"><strong>Sync status</strong></div><span className="wf-setting-status" role="status">{syncStatus}</span></div>
 <div className="wf-setting-row"><span className="wf-setting-symbol"><Download size={21}/></span><div className="wf-setting-copy"><strong>Export vocabulary</strong></div><button type="button" className="wf-setting-action" disabled={words===null} onClick={exportLocal}><Download size={16}/>Export</button></div>
 <div className="wf-setting-row"><span className="wf-setting-symbol"><RefreshCw size={21}/></span><div className="wf-setting-copy"><strong>Reload workspace</strong></div><button type="button" className="wf-setting-action" disabled={busy||translating} onClick={()=>setReload(n=>n+1)}><RefreshCw size={16}/>Reload</button></div>
 <div className="wf-setting-row"><span className="wf-setting-symbol"><ShieldCheck size={21}/></span><div className="wf-setting-copy"><strong>Translation privacy</strong><small>Text is sent to external translation providers. Avoid entering private information.</small></div></div></motion.section>
 <motion.section className="wf-setting-card wf-setting-account" initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} transition={{duration:.18,delay:.06}}>
 <header className="wf-setting-head"><span className="wf-setting-mark" data-tone="blue"><UserRound size={25}/></span><div><h3>Account</h3></div></header>
 <div className="wf-setting-row"><span className="wf-setting-symbol"><ShieldCheck size={21}/></span><div className="wf-setting-copy"><strong>Profile & security</strong></div><button type="button" className="wf-setting-action" onClick={()=>setView('profile')}>Manage<ChevronRight size={16}/></button></div>
 <div className="wf-setting-row"><span className="wf-setting-symbol wf-setting-danger"><LogOut size={21}/></span><div className="wf-setting-copy"><strong>Sign out</strong></div><button type="button" className="wf-setting-action wf-setting-danger" disabled={busy||translating} onClick={()=>void signOut()}>Sign out<LogOut size={16}/></button></div>
 </motion.section>
 </div>:<>
 <section className="wf-panel wf-translator"><form onSubmit={translateInput} className="wf-translate-form"><input id="wf-source" dir="auto" aria-label="Enter an English or Persian word or phrase to translate and save" value={source} onChange={e=>setSource(e.target.value)} maxLength={500} required placeholder="Enter a word or phrase to translate…" disabled={translating}/><button className="wf-primary" disabled={translating||busy||blocked||words===null||!source.trim()}>{translating?'Translating…':'Translate'}</button></form>{editing!==null&&<motion.form initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:.15}} onSubmit={submit} className="wf-result-form"><div className="wf-result-fields"><label>English<input value={en} onChange={e=>setEn(e.target.value)} required dir="ltr"/></label><label>فارسی<input value={fa} onChange={e=>setFa(e.target.value)} required dir="rtl" lang="fa"/></label></div><div className="wf-result-actions"><button type="button" className="wf-action" onClick={reset}>Cancel edit</button><button className="wf-primary" disabled={words===null||busy||blocked||translating||!en.trim()||!fa.trim()}>Save changes</button></div></motion.form>}</section><div className="wf-panel"><div className="wf-library-heading"><strong>My vocabulary <small>{words?.length??0}</small></strong><div className="wf-segments">{(['active','kept'] as const).map(id=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{id==='active'?'Active':'Kept'}</button>)}</div></div>
 {filtered.length===0?<p>{words===null?'Loading vocabulary…':words.length===0?'No saved words.':filter==='kept'?'No kept words.':'No active words.'}</p>:<ul className="wf-word-list">{filtered.map(({word,index})=><li key={index} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="flex items-center gap-2">{word.en}<PronounceButton text={word.en} onError={setError} label={"Pronounce "+word.en}/></span><span lang="fa" dir="rtl">{word.fa}</span><div className="flex gap-2">{deleting===index?<><button type="button" disabled={busy||blocked||translating} onClick={()=>void persist(removeWord(words??[],index),'Word deleted.')} className="rounded-lg border border-red-500 px-2 py-1">Confirm delete</button><button type="button" disabled={busy} onClick={()=>setDeleting(null)} className="px-2">Cancel</button></>:<><button type="button" disabled={busy||blocked||translating} onClick={()=>{setEditing(index);setEn(word.en);setFa(word.fa);setDeleting(null);pageRef.current?.scrollTo({top:0,behavior:'auto'});}} className="wf-action" aria-label="Edit word"><Pencil size={16}/></button><button type="button" className="wf-action" aria-label="Copy word" onClick={()=>void copy(word.en+" — "+word.fa)}><Copy size={16}/></button><button type="button" className="wf-action" disabled={busy||blocked||translating} aria-label={word.kept?"Return to active":"Keep word"} onClick={()=>void persist((words??[]).map((w,i)=>i===index?{...w,kept:!w.kept}:w),word.kept?"Word returned.":"Word kept.")}><Check size={16}/></button><button type="button" disabled={busy||blocked||translating} onClick={()=>setDeleting(index)} className="wf-action" aria-label="Delete word"><Trash2 size={16}/></button></>}</div></li>)}</ul>}
 </div></>}
 </motion.div></section></div>;
}
