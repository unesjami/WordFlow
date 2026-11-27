import {useEffect,useRef,useState} from 'react';
import {motion,AnimatePresence} from 'motion/react';
import {BookOpen,RefreshCw,Brain,UserRound,Download,Cloud,LoaderCircle,ArrowRightLeft,Trash2,Settings,Check,ChevronLeft,ChevronRight,Copy,Sun,Moon,Monitor,LogOut,ShieldCheck,X} from 'lucide-react';
import {metrics} from '../profile/analytics';
import type {FormEvent} from 'react';
import type {Word} from '../../domain';
import {classifyText,entryKind,learningWords} from '../../domain';
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
 const [filter,setFilter]=useState<'active'|'kept'|'sentences'>('active');
 const [cardIndex,setCardIndex]=useState(0);
 const [cardReveal,setCardReveal]=useState(false);

 const [undo,setUndo]=useState<{word:Word;index:number;expires:number}|null>(null);
 const [undoSeconds,setUndoSeconds]=useState(5);
 const [busy,setBusy]=useState(false);
 const [blocked,setBlocked]=useState(false);
 const [error,setError]=useState('');

 const generation=useRef(0);
 const locked=useRef(false);
 const [reload,setReload]=useState(0);
 const [source,setSource]=useState('');
 const [translating,setTranslating]=useState(false);
 const translationRequest=useRef<AbortController|null>(null);
 useEffect(()=>()=>{translationRequest.current?.abort();stopSpeech();},[]);
 async function translateInput(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(translationRequest.current||locked.current||blocked||!snapshot.current||!source.trim())return;
  const controller=new AbortController();translationRequest.current=controller;setTranslating(true);setError('');
  const text=source.trim(),language=detectLanguage(text),current=generation.current;
  try{
   const result=await translate(text,language,language==='en'?'fa':'en',controller.signal);
   if(controller.signal.aborted||generation.current!==current)return;
   const latest=snapshot.current;if(!latest)throw Error('Vocabulary unavailable. Reload and retry.');
   const english=language==='en'?text:result;
   const kind=classifyText(text)==='sentence'||classifyText(english)==='sentence'?'sentence':'word';
   const next=saveWord(latest.words,english,language==='fa'?text:result,null,kind);
   if(await persist(next,kind==='sentence'?'Sentence added.':'Word added.')){
    setSource('');setFilter(kind==='sentence'?'sentences':'active');
   }
  }
  catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Translation failed.');}
  finally{if(translationRequest.current===controller){translationRequest.current=null;setTranslating(false);}}
 }

 useEffect(()=>{
   const current=++generation.current;
   setWords(null);snapshot.current=null;setError('');setBlocked(false);setBusy(false);locked.current=false;setUndo(null);
   openWorkspace(userId).then(result=>{if(generation.current===current){snapshot.current=result;setWords(result.words);setSyncStatus(result.dirty?'Pending sync':'Saved locally');}}).catch(()=>{if(generation.current===current)setError('Could not load vocabulary. Your data was not changed.');});
   return ()=>{generation.current++;};
 },[userId,reload]);
 async function copy(text:string){try{await navigator.clipboard.writeText(text);}catch{setError('Could not copy.');}}

 async function persist(next:Word[],_success:string):Promise<boolean>{
   if(locked.current||blocked||!snapshot.current)return false;
   locked.current=true;setBusy(true);setError('');
   const current=generation.current;
   try{const previous=snapshot.current;if(!previous)throw Error('Workspace unavailable');const local=makeSnapshot(userId,next,previous.revision,true);await storeLocal(local,previous.version);if(generation.current!==current)return false;snapshot.current=local;setWords(next);setSyncStatus('Pending sync');return true;}
   catch(e){if(generation.current===current){setBlocked(true);setError(e instanceof Error?e.message:'Save failed. Reload before retrying.');}return false;}
   finally{if(generation.current===current){locked.current=false;setBusy(false);}}
 }
 useEffect(()=>{let active=true;async function flush(){const local=snapshot.current;if(!active||!local?.dirty||locked.current||translationRequest.current||!navigator.onLine)return;locked.current=true;setBusy(true);setSyncStatus('Syncing');try{const clean=await syncLocal(local);if(active&&snapshot.current?.version===local.version){snapshot.current=clean;setSyncStatus('Synced');}}catch(e){if(active){setSyncStatus('Pending sync');setError(e instanceof Error?e.message:'Cloud sync unavailable. Local changes preserved.');}}finally{if(active){locked.current=false;setBusy(false);}}}const timer=window.setInterval(()=>void flush(),15000);window.addEventListener('online',flush);void flush();return()=>{active=false;window.clearInterval(timer);window.removeEventListener('online',flush);};},[userId,reload]);
 useEffect(()=>{if(!undo)return;const tick=()=>{const remaining=Math.max(0,Math.ceil((undo.expires-Date.now())/1000));setUndoSeconds(remaining);if(!remaining)setUndo(current=>current===undo?null:current);};tick();const timer=window.setInterval(tick,100);return()=>window.clearInterval(timer);},[undo]);
 async function deleteEntry(index:number){const local=snapshot.current;if(!local||locked.current||blocked||translationRequest.current)return;const word=local.words[index];if(!word)return;stopSpeech();if(await persist(removeWord(local.words,index),'Deleted.')){setUndoSeconds(5);setUndo({word,index,expires:Date.now()+5000});}}
 async function restoreEntry(){const local=snapshot.current;if(!undo||!local||locked.current||blocked||translationRequest.current||Date.now()>=undo.expires)return;const next=[...local.words];next.splice(Math.min(undo.index,next.length),0,undo.word);if(await persist(next,'Restored.'))setUndo(null);}
 function exportLocal(){const local=snapshot.current;if(!local)return;const url=URL.createObjectURL(new Blob([JSON.stringify({words:local.words,revision:local.revision},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='wordflow-local-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const nav=[{id:'vocabulary',label:'Vocabulary',Icon:BookOpen},{id:'learn',label:'Learn',Icon:Brain},{id:'profile',label:'Profile',Icon:UserRound},{id:'settings',label:'Settings',Icon:Settings}] as const;
 const studyWords=learningWords(words??[]);
 const stats=metrics(studyWords);
 const cards=studyWords.filter(w=>!w.kept);const currentCard=cards[Math.min(cardIndex,Math.max(0,cards.length-1))];
 const filtered=(words??[]).map((word,index)=>({word,index})).filter(({word})=>filter==='sentences'?entryKind(word)==='sentence':entryKind(word)==='word'&&(filter==='kept'?word.kept:!word.kept)).sort((a,b)=>b.word.timestamp-a.word.timestamp);
 const pageRef=useRef<HTMLDivElement>(null);
 useEffect(()=>{pageRef.current?.scrollTo({top:0});},[view]);
 return <div className="wf-workspace" data-sidebar-collapsed={collapsed&&!railHover} data-sidebar-pinned={ !collapsed }>
 <nav aria-label="Learning views" className="wf-sidebar" id="wf-navigation" onPointerEnter={e=>{if(e.pointerType==='mouse'&&window.matchMedia('(hover:hover) and (min-width:761px)').matches)setRailHover(true);}} onPointerLeave={()=>setRailHover(false)}><div className="wf-sidebar-top"><span className="wf-sidebar-title">Workspace</span><button type="button" className="wf-sidebar-toggle" aria-label={collapsed?"Expand navigation":"Collapse navigation"} aria-expanded={!collapsed} title={collapsed?"Expand navigation":"Collapse navigation"} onClick={()=>{setRailHover(false);setCollapsed(v=>!v);}}>{collapsed?<ChevronRight size={16}/>:<ChevronLeft size={16}/>}</button></div>{nav.map(({id,label,Icon})=><button key={id} type="button" aria-label={label} title={label} aria-current={view===id?'page':undefined} onClick={()=>{stopSpeech();setView(id);}} className="wf-nav-button">{view===id&&<motion.span layoutId="wf-active-tab" className="wf-nav-active" transition={{type:'spring',stiffness:400,damping:35}}/>}<Icon size={20}/><span className="wf-nav-label">{label}</span></button>)}</nav>
 <section className="wf-main" aria-labelledby="workspace-title">
 <div className="wf-toolbar"><div><h2 id="workspace-title">{nav.find(n=>n.id===view)?.label}</h2></div></div>
 <div className="wf-inline-feedback" aria-live="polite">{error&&<div role="alert" className="wf-inline-error"><span>{error}</span><button type="button" aria-label="Dismiss error" title="Dismiss" onClick={()=>setError('')}><X size={16}/></button></div>}</div>
 <motion.div ref={pageRef} key={view} className="wf-page" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:.18}}>
 {words===null&&(view==='learn'||view==='profile')?<p role="status">{error?'Vocabulary unavailable':'Loading vocabulary…'}</p>:view==='learn'?<><div className="wf-learn-overview"><div><strong>{stats.due}</strong><span>Due for review</span></div><div><strong>{stats.words}</strong><span>Saved words</span></div><div><strong>{stats.reviewed}</strong><span>Reviewed</span></div></div><div className="wf-segments" aria-label="Learning mode">{(['review','practice','cards'] as const).map(mode=><button key={mode} aria-pressed={learnMode===mode} onClick={()=>{stopSpeech();setLearnMode(mode);setCardIndex(0);setCardReveal(false);}}>{mode==='review'?'Review':mode==='practice'?'Practice':'Flashcards'}</button>)}</div><motion.div key={learnMode} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:.15}}>{learnMode==='review'?<ReviewPanel key={reload} words={words??[]} disabled={busy||blocked||translating} save={async next=>{if(translationRequest.current)return false;const changed=next.find((w,i)=>w.review!==words?.[i]?.review);const ok=await persist(next,'Review saved.');if(ok&&changed?.review)recordActivity(userId,'review',changed.review.interval>0);return ok;}}/>:learnMode==='practice'?<PracticePanel key={reload} words={studyWords} onActivity={correct=>recordActivity(userId,'practice',correct)}/>:<div className="wf-panel"><div className="grid gap-3">{currentCard?<><p className="text-center text-sm">{Math.min(cardIndex+1,cards.length)} / {cards.length}</p><motion.button key={currentCard.timestamp+String(cardReveal)} type="button" className="wf-study-card" initial={{opacity:0,scale:.98}} animate={{opacity:1,scale:1}} onClick={()=>setCardReveal(v=>!v)}><strong className="text-3xl" dir="auto">{cardReveal?currentCard.fa:currentCard.en}</strong><span className="text-xs opacity-70">{cardReveal?"Tap to hide":"Tap to reveal"}</span></motion.button><div className="flex justify-center gap-2"><button className="wf-action" aria-label="Previous card" disabled={cardIndex===0} onClick={()=>{setCardIndex(i=>Math.max(0,i-1));setCardReveal(false);}}><ChevronLeft size={18}/></button><PronounceButton text={currentCard.en} onError={setError} label="Pronounce card"/><button className="wf-action" aria-label="Next card" disabled={cardIndex>=cards.length-1} onClick={()=>{setCardIndex(i=>i+1);setCardReveal(false);}}><ChevronRight size={18}/></button></div></>:<p className="wf-empty">No active cards.</p>}</div></div>}</motion.div></>: view==='profile'?<Profile user={user} words={studyWords}/>:view==='settings'?<div className="wf-settings-grid">
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
 <section className="wf-panel wf-translator"><form autoComplete="off" onSubmit={translateInput} className="wf-translate-form"><textarea id="wf-source" rows={1} autoComplete="off" dir="auto" aria-label="Translate and save a word or sentence" value={source} onChange={e=>setSource(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit();}}} maxLength={500} required placeholder="Translate a word or sentence…" disabled={translating}/><button className="wf-primary wf-translate-button" aria-busy={translating} disabled={translating||busy||blocked||words===null||!source.trim()}>{translating?<><LoaderCircle size={18} className="wf-pronounce-spinner"/>Translating</>:'Translate'}</button></form></section>
 <div className="wf-panel"><div className="wf-library-heading"><strong>My vocabulary</strong><div className="wf-segments">{(['active','kept','sentences'] as const).map(id=><button key={id} aria-pressed={filter===id} onClick={()=>{setFilter(id);}}>{id==='active'?'Words':id==='kept'?'Kept':'Sentences'}</button>)}</div></div>
 {filtered.length===0?<p className="wf-empty">{words===null?'Loading…':filter==='sentences'?'No sentences yet.':filter==='kept'?'No kept words.':'No words yet.'}</p>:<ul className="wf-entry-list">{filtered.map(({word,index})=><motion.li key={index} layout="position" initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} className="wf-entry">
 <div className="wf-entry-text"><div className="wf-entry-line wf-entry-english"><PronounceButton text={word.en} onError={setError} label={"Pronounce "+word.en}/><button type="button" className="wf-entry-icon" title="Copy English" aria-label="Copy English" onClick={()=>void copy(word.en)}><Copy size={15}/></button><span dir="auto">{word.en}</span></div><div className="wf-entry-line" lang="fa"><span dir="rtl">{word.fa}</span><button type="button" className="wf-entry-icon" title="Copy Persian" aria-label="Copy Persian" onClick={()=>void copy(word.fa)}><Copy size={15}/></button></div>{word.example&&entryKind(word)==='word'&&<p className="wf-entry-example" dir="auto">{word.example}</p>}</div>
 <div className="wf-entry-actions">{entryKind(word)==='word'&&<button type="button" className="wf-entry-icon wf-entry-check" title={word.kept?'Return to practice':'Mark as learned'} aria-label={word.kept?'Return to practice':'Mark as learned'} disabled={busy||blocked||translating} onClick={()=>void persist((words??[]).map((w,i)=>i===index?{...w,kept:!w.kept}:w),word.kept?'Word returned.':'Word kept.')}>{word.kept?<ArrowRightLeft size={17}/>:<Check size={17}/>}</button>}<button type="button" className="wf-entry-icon wf-entry-delete" title="Delete" aria-label="Delete" disabled={busy||blocked||translating} onClick={()=>void deleteEntry(index)}><Trash2 size={17}/></button></>}</div>
 </motion.li>)}</ul>}
 </div></>}
 </motion.div></section><AnimatePresence>{undo&&<motion.div key={undo.expires} className="wf-undo-toast" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}} transition={{duration:.18}}><span role="status">{entryKind(undo.word)==='sentence'?'Sentence deleted':'Word deleted'}</span><button type="button" disabled={busy||blocked||translating} onClick={()=>void restoreEntry()}>Undo</button><span className="wf-undo-count" aria-hidden="true">{undoSeconds}</span><div className="wf-undo-track" aria-hidden="true"><motion.div initial={{scaleX:1}} animate={{scaleX:0}} transition={{duration:5,ease:'linear'}}/></div></motion.div>}</AnimatePresence></div>;
}
