import {useEffect,useRef,useState} from 'react';
import {motion,AnimatePresence} from 'motion/react';
import {BookOpen,RefreshCw,Brain,UserRound,Download,Cloud,LoaderCircle,ArrowRightLeft,Trash2,Settings,Check,ChevronLeft,ChevronRight,Copy,Sun,Moon,Monitor,LogOut,ShieldCheck,X,PanelLeft,Palette} from 'lucide-react';
import {metrics} from '../profile/analytics';
import type {FormEvent,CSSProperties} from 'react';
import type {Word} from '../../domain';
import {classifyText,entryKind,learningWords} from '../../domain';
import type {User} from '@supabase/supabase-js';
import {Profile} from '../profile/Profile';
import {recordActivity} from '../profile/analytics';
import {openWorkspace,storeLocal,makeSnapshot,uploadSnapshot,acknowledgeSnapshot} from '../../services/offline';
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
 const palettes=[{id:'teal',name:'Teal',color:'#146464'},{id:'blue',name:'Blue',color:'#2563eb'},{id:'violet',name:'Violet',color:'#7c3aed'},{id:'green',name:'Emerald',color:'#16804a'},{id:'rose',name:'Rose',color:'#be185d'},{id:'slate',name:'Slate',color:'#475569'}] as const;
 const [accent,setAccent]=useState(()=>{try{return localStorage.getItem('wf-color-theme')||'teal';}catch{return 'teal';}});
 useEffect(()=>{const value=palettes.some(p=>p.id===accent)?accent:'teal';document.documentElement.dataset.accent=value;try{localStorage.setItem('wf-color-theme',value);}catch{}},[accent]);
 const [collapsed,setCollapsed]=useState(()=>{try{return localStorage.getItem('wf-sidebar-collapsed')==='1';}catch{return false;}});
 useEffect(()=>{try{localStorage.setItem('wf-sidebar-collapsed',collapsed?'1':'0');}catch{}},[collapsed]);
 const [learnMode,setLearnMode]=useState<'review'|'practice'|'cards'>('review');
 const [words,setWords]=useState<Word[]|null>(null);
 const [loadFailed,setLoadFailed]=useState(false);
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
 const localTail=useRef<Promise<unknown>>(Promise.resolve());
 const syncing=useRef(false);
 const [cloudBusy,setCloudBusy]=useState(false);
 function serializeLocal<T>(task:()=>Promise<T>):Promise<T>{const next=localTail.current.then(task,task);localTail.current=next.catch(()=>{});return next;}

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
    refocusSource.current=true;setSource('');setFilter(kind==='sentence'?'sentences':'active');
   }
  }
  catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Translation failed.');}
  finally{if(translationRequest.current===controller){translationRequest.current=null;setTranslating(false);}}
 }

 useEffect(()=>{
   const current=++generation.current;
   setWords(null);setLoadFailed(false);snapshot.current=null;setError('');setBlocked(false);setBusy(false);locked.current=false;setUndo(null);setCloudBusy(false);syncing.current=false;
   openWorkspace(userId).then(result=>{if(generation.current===current){snapshot.current=result;setWords(result.words);setSyncStatus(result.dirty?'Pending sync':'Saved locally');}}).catch(()=>{if(generation.current===current){setLoadFailed(true);setError('Could not load vocabulary. Your data was not changed.');}});
   return ()=>{generation.current++;};
 },[userId,reload]);
 async function copy(text:string){try{await navigator.clipboard.writeText(text);}catch{setError('Could not copy.');}}

 async function persist(next:Word[],_success:string):Promise<boolean>{
   if(locked.current||blocked||!snapshot.current)return false;
   locked.current=true;setBusy(true);setError('');
   const current=generation.current;
   try{return await serializeLocal(async()=>{if(generation.current!==current)return false;const previous=snapshot.current;if(!previous)throw Error('Workspace unavailable');const local=makeSnapshot(userId,next,previous.revision,true);await storeLocal(local,previous.version);if(generation.current!==current)return false;snapshot.current=local;setWords(next);setSyncStatus('Pending sync');return true;});}
   catch(e){if(generation.current===current){setBlocked(true);setError(e instanceof Error?e.message:'Save failed. Reload before retrying.');}return false;}
   finally{if(generation.current===current){locked.current=false;setBusy(false);}}
 }
 useEffect(()=>{
 let active=true;
 async function flush(){
  const local=snapshot.current;
  if(!active||!local?.dirty||locked.current||syncing.current||!navigator.onLine)return;
  syncing.current=true;setCloudBusy(true);setSyncStatus('Syncing');
  try{
   const revision=await uploadSnapshot(local);
   await serializeLocal(async()=>{
    if(!active)return;
    const latest=snapshot.current;if(!latest)return;
    const updated=acknowledgeSnapshot(local,latest,revision);
    await storeLocal(updated,latest.version);
    if(!active)return;
    snapshot.current=updated;setSyncStatus(updated.dirty?'Pending sync':'Synced');
   });
  }catch(e){if(active){const message=e instanceof Error?e.message:'Cloud sync unavailable';setSyncStatus(message.includes('changed')?'Sync conflict · local data saved':'Pending sync');}}
  finally{if(active){syncing.current=false;setCloudBusy(false);}}
 }
 const timer=window.setInterval(()=>void flush(),15000);
 window.addEventListener('online',flush);void flush();
 return()=>{active=false;window.clearInterval(timer);window.removeEventListener('online',flush);};
 },[userId,reload]);
 useEffect(()=>{if(!undo)return;const tick=()=>{const remaining=Math.max(0,Math.ceil((undo.expires-Date.now())/1000));setUndoSeconds(remaining);if(!remaining)setUndo(current=>current===undo?null:current);};tick();const timer=window.setInterval(tick,100);return()=>window.clearInterval(timer);},[undo]);
 async function deleteEntry(index:number){const local=snapshot.current;if(!local||locked.current||blocked||translationRequest.current)return;const word=local.words[index];if(!word)return;stopSpeech();if(await persist(removeWord(local.words,index),'Deleted.')){setUndoSeconds(5);setUndo({word,index,expires:Date.now()+5000});}}
 async function restoreEntry(){const local=snapshot.current;if(!undo||!local||locked.current||blocked||translationRequest.current||Date.now()>=undo.expires)return;const next=[...local.words];next.splice(Math.min(undo.index,next.length),0,undo.word);if(await persist(next,'Restored.'))setUndo(null);}
 function exportLocal(){const local=snapshot.current;if(!local)return;const url=URL.createObjectURL(new Blob([JSON.stringify({words:local.words,revision:local.revision},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='wordflow-local-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 const nav=[{id:'vocabulary',label:'Word Studio',Icon:BookOpen},{id:'learn',label:'Learn',Icon:Brain},{id:'profile',label:'Profile',Icon:UserRound},{id:'settings',label:'Settings',Icon:Settings}] as const;
 const studyWords=learningWords(words??[]);
 const stats=metrics(studyWords);
 const cards=studyWords.filter(w=>!w.kept);const currentCard=cards[Math.min(cardIndex,Math.max(0,cards.length-1))];
 const entryOccurrences=new Map<string,number>();
 const filtered=(words??[]).map((word,index)=>{const identity=JSON.stringify([word.timestamp,word.en,word.fa]);const occurrence=entryOccurrences.get(identity)??0;entryOccurrences.set(identity,occurrence+1);return {word,index,rowKey:identity+':'+occurrence};}).filter(({word})=>filter==='sentences'?entryKind(word)==='sentence':entryKind(word)==='word'&&(filter==='kept'?word.kept:!word.kept)).sort((a,b)=>b.word.timestamp-a.word.timestamp);
 const pageRef=useRef<HTMLDivElement>(null);
 const sourceRef=useRef<HTMLTextAreaElement>(null);
 const refocusSource=useRef(false);
 useEffect(()=>{if(!translating&&refocusSource.current){refocusSource.current=false;if(view==='vocabulary')sourceRef.current?.focus({preventScroll:true});}},[translating,view]);
 useEffect(()=>{pageRef.current?.scrollTo({top:0});},[view]);
 return <div className="wf-workspace" data-sidebar-collapsed={collapsed&&!railHover} data-sidebar-pinned={ !collapsed }>
 <nav aria-label="Learning views" className="wf-sidebar" id="wf-navigation" onPointerEnter={e=>{if(e.pointerType==='mouse'&&window.matchMedia('(hover:hover) and (min-width:761px)').matches)setRailHover(true);}} onPointerLeave={()=>setRailHover(false)} data-pointer-inside={railHover}><div className="wf-sidebar-top"><div className="wf-sidebar-brand"><img src="./icon.svg" alt="" width="34" height="34"/><span>WordFlow</span></div><button type="button" className="wf-sidebar-toggle" aria-label={collapsed?"Pin navigation":"Unpin navigation"} aria-pressed={!collapsed} aria-controls="wf-navigation" title={collapsed?"Pin navigation":"Unpin navigation"} onClick={e=>{setCollapsed(v=>!v);if(e.detail>0)e.currentTarget.blur();}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16"/>{!collapsed&&<path d="M6 5h2v14H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="currentColor" stroke="none"/>}</svg></button></div>{nav.map(({id,label,Icon})=><button key={id} type="button" aria-label={label} title={label} aria-current={view===id?'page':undefined} onClick={()=>{stopSpeech();setView(id);}} className={"wf-nav-button"+(id==='settings'?' wf-nav-settings':'')}>{view===id&&<motion.span layoutId="wf-active-tab" className="wf-nav-active" transition={{type:'spring',stiffness:400,damping:35}}/>}<Icon size={20}/><span className="wf-nav-label">{label}</span></button>)}</nav>
 <section className="wf-main" aria-labelledby="workspace-title">
 <div className="wf-toolbar"><div><h2 id="workspace-title">{nav.find(n=>n.id===view)?.label}</h2></div></div>
 <div className="wf-inline-feedback" aria-live="polite">{error&&<div role="alert" className="wf-inline-error"><span>{error}</span><button type="button" aria-label="Dismiss error" title="Dismiss" onClick={()=>setError('')}><X size={16}/></button></div>}</div>
 <motion.div ref={pageRef} key={view} className="wf-page" initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:.18}}>
 {words===null&&(view==='learn'||view==='profile')?<p role="status">{error?'Vocabulary unavailable':'Loading vocabulary…'}</p>:view==='learn'?<><div className="wf-learn-overview"><div><strong>{stats.due}</strong><span>Due for review</span></div><div><strong>{stats.words}</strong><span>Saved words</span></div><div><strong>{stats.reviewed}</strong><span>Reviewed</span></div></div><div className="wf-segments" aria-label="Learning mode">{(['review','practice','cards'] as const).map(mode=><button key={mode} aria-pressed={learnMode===mode} onClick={()=>{stopSpeech();setLearnMode(mode);setCardIndex(0);setCardReveal(false);}}>{mode==='review'?'Review':mode==='practice'?'Practice':'Flashcards'}</button>)}</div><motion.div key={learnMode} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{duration:.15}}>{learnMode==='review'?<ReviewPanel key={reload} words={words??[]} disabled={busy||blocked||translating} save={async next=>{if(translationRequest.current)return false;const changed=next.find((w,i)=>w.review!==words?.[i]?.review);const ok=await persist(next,'Review saved.');if(ok&&changed?.review)recordActivity(userId,'review',changed.review.interval>0);return ok;}}/>:learnMode==='practice'?<PracticePanel key={reload} words={studyWords} onActivity={correct=>recordActivity(userId,'practice',correct)}/>:<div className="wf-panel"><div className="grid gap-3">{currentCard?<><p className="text-center text-sm">{Math.min(cardIndex+1,cards.length)} / {cards.length}</p><motion.button key={currentCard.timestamp+String(cardReveal)} type="button" className="wf-study-card" initial={{opacity:0,scale:.98}} animate={{opacity:1,scale:1}} onClick={()=>setCardReveal(v=>!v)}><strong className="text-3xl" dir="auto">{cardReveal?currentCard.fa:currentCard.en}</strong><span className="text-xs opacity-70">{cardReveal?"Tap to hide":"Tap to reveal"}</span></motion.button><div className="flex justify-center gap-2"><button className="wf-action" aria-label="Previous card" disabled={cardIndex===0} onClick={()=>{setCardIndex(i=>Math.max(0,i-1));setCardReveal(false);}}><ChevronLeft size={18}/></button><PronounceButton text={currentCard.en} onError={setError} label="Pronounce card"/><button className="wf-action" aria-label="Next card" disabled={cardIndex>=cards.length-1} onClick={()=>{setCardIndex(i=>i+1);setCardReveal(false);}}><ChevronRight size={18}/></button></div></>:<p className="wf-empty">No active cards.</p>}</div></div>}</motion.div></>: view==='profile'?<Profile user={user} words={studyWords}/>:view==='settings'?<div className="wf-settings-grid">
 <motion.section className="wf-setting-card" initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} transition={{duration:.18}}>
 <header className="wf-setting-head"><span className="wf-setting-mark"><Sun size={25}/></span><div><h3>App preferences</h3></div></header>
 <div className="wf-setting-row"><span className="wf-setting-symbol"><Monitor size={21}/></span><div className="wf-setting-copy"><strong>Appearance</strong></div><div className="wf-theme-compact" role="group" aria-label="Appearance">{([{value:"light",Icon:Sun,label:"Light"},{value:"dark",Icon:Moon,label:"Dark"},{value:"system",Icon:Monitor,label:"Device"}] as const).map(({value,Icon,label})=><button key={value} type="button" title={label} aria-label={label} aria-pressed={theme===value} onClick={()=>setTheme(value)}>{theme===value&&<motion.span layoutId="wf-settings-theme-thumb" className="wf-theme-thumb" transition={{type:'spring',stiffness:450,damping:38}}/>}<Icon size={17}/></button>)}</div></div>
 <div className="wf-setting-row wf-color-row"><span className="wf-setting-symbol"><Palette size={21}/></span><div className="wf-setting-copy"><strong>Color theme</strong></div><div className="wf-color-options" role="group" aria-label="Color theme">{palettes.map(p=><button key={p.id} type="button" className="wf-color-option" style={{'--swatch':p.color} as CSSProperties} aria-label={p.name} title={p.name} aria-pressed={accent===p.id} onClick={()=>setAccent(p.id)}><span className="wf-color-swatch">{accent===p.id&&<Check size={13}/>}</span></button>)}</div></div>
 <div className="wf-setting-row"><span className="wf-setting-symbol"><Settings size={21}/></span><div className="wf-setting-copy"><strong>Compact navigation</strong></div><button type="button" role="switch" aria-checked={collapsed} aria-label="Compact navigation" className="wf-setting-switch" onClick={()=>{setRailHover(false);setCollapsed(v=>!v);}}><span/></button></div>
 </motion.section>
 <motion.section className="wf-setting-card" initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} transition={{duration:.18,delay:.03}}>
 <header className="wf-setting-head"><span className="wf-setting-mark"><BookOpen size={25}/></span><div><h3>Data & sync</h3></div></header>
 <div className="wf-setting-row"><span className="wf-setting-symbol"><Cloud size={21}/></span><div className="wf-setting-copy"><strong>Sync status</strong></div><span className="wf-setting-status" role="status">{syncStatus}</span></div>
 <div className="wf-setting-row"><span className="wf-setting-symbol"><Download size={21}/></span><div className="wf-setting-copy"><strong>Export vocabulary</strong></div><button type="button" className="wf-setting-action" disabled={words===null} onClick={exportLocal}><Download size={16}/>Export</button></div>
 </motion.section>
 <motion.section className="wf-setting-card wf-setting-account" initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} transition={{duration:.18,delay:.06}}>
 <header className="wf-setting-head"><span className="wf-setting-mark"><UserRound size={25}/></span><div><h3>Account</h3></div></header>
 <div className="wf-setting-row"><span className="wf-setting-symbol"><ShieldCheck size={21}/></span><div className="wf-setting-copy"><strong>Profile & security</strong></div><button type="button" className="wf-setting-action" onClick={()=>setView('profile')}>Manage<ChevronRight size={16}/></button></div>
 <div className="wf-setting-row"><span className="wf-setting-symbol wf-setting-danger"><LogOut size={21}/></span><div className="wf-setting-copy"><strong>Sign out</strong></div><button type="button" className="wf-setting-action wf-setting-danger" disabled={busy||translating||cloudBusy} onClick={()=>void signOut()}>Sign out<LogOut size={16}/></button></div>
 </motion.section>
 </div>:<>
 <section className="wf-panel wf-translator" aria-label="Translate and save"><form autoComplete="off" onSubmit={translateInput} className="wf-translate-form"><textarea ref={sourceRef} id="wf-source" rows={1} autoComplete="off" dir="auto" aria-label="Translate and save a word or sentence" value={source} onChange={e=>setSource(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit();}}} maxLength={500} required placeholder="Type a word or sentence…" disabled={translating}/><button className="wf-primary wf-translate-button" aria-busy={translating} disabled={translating||busy||blocked||words===null||!source.trim()}>{translating?<><LoaderCircle size={18} className="wf-pronounce-spinner"/>Translating</>:'Type'}</button></form></section>
 <motion.section layout="size" transition={{layout:{duration:.24,ease:[.22,.8,.25,1]}}} className="wf-panel wf-library-panel" aria-labelledby="wf-library-title" aria-busy={words===null&&!loadFailed}><motion.div layout="position" className="wf-library-heading"><h3 id="wf-library-title">My Collection</h3><div className="wf-segments" role="group" aria-label="Vocabulary collection">{(['active','kept','sentences'] as const).map(id=><button key={id} aria-pressed={filter===id} onClick={()=>{setFilter(id);}}>{id==='active'?'Words':id==='kept'?'Learned':'Sentences'}</button>)}</div></motion.div>
 {words===null?(loadFailed?<div className="wf-empty"><button type="button" className="wf-action" onClick={()=>setReload(n=>n+1)}><RefreshCw size={16}/>Retry</button></div>:<div className="wf-list-placeholder" role="status" aria-label="Loading vocabulary">{[0,1,2].map(i=><div className="wf-placeholder-row" key={i} aria-hidden="true"><span/><span/><span/></div>)}</div>):filtered.length===0?<p className="wf-empty">{filter==='sentences'?'No sentences yet.':filter==='kept'?'No learned words yet.':'Translate a word to start.'}</p>:<ul className="wf-entry-list"><AnimatePresence initial={false} mode="popLayout">{filtered.map(({word,index,rowKey})=><motion.li key={rowKey} layout="position" initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-4,pointerEvents:"none"}} transition={{duration:.16,layout:{duration:.24,ease:[.22,.8,.25,1]}}} className="wf-entry">
 <div className="wf-entry-text"><div className="wf-entry-line wf-entry-english" dir="ltr"><PronounceButton text={word.en} onError={setError} label={"Pronounce "+word.en}/><button type="button" className="wf-entry-icon" title="Copy English" aria-label={"Copy English: "+word.en} onClick={()=>void copy(word.en)}><Copy size={15}/></button><span dir="auto">{word.en}</span></div><div className="wf-entry-line wf-entry-persian" lang="fa" dir="ltr"><span dir="rtl">{word.fa}</span><button type="button" className="wf-entry-icon" title="Copy Persian" aria-label={"Copy Persian: "+word.fa} onClick={()=>void copy(word.fa)}><Copy size={15}/></button></div>{word.example&&entryKind(word)==='word'&&<p className="wf-entry-example" dir="auto">{word.example}</p>}</div>
 <div className="wf-entry-actions" role="group" aria-label={"Actions for "+word.en}>{entryKind(word)==='word'&&<button type="button" className="wf-entry-icon wf-entry-check" title={word.kept?'Return to practice':'Mark as learned'} aria-label={word.kept?'Return to practice':'Mark as learned'} disabled={busy||blocked||translating} onClick={()=>void persist((words??[]).map((w,i)=>i===index?{...w,kept:!w.kept}:w),word.kept?'Word returned.':'Word kept.')}>{word.kept?<ArrowRightLeft size={17}/>:<Check size={17}/>}</button>}<button type="button" className="wf-entry-icon wf-entry-delete" title="Delete" aria-label={"Delete: "+word.en} disabled={busy||blocked||translating} onClick={()=>void deleteEntry(index)}><Trash2 size={17}/></button></div>
 </motion.li>)}</AnimatePresence></ul>}
 </motion.section></>}
 </motion.div></section><AnimatePresence>{undo&&<motion.div key={undo.expires} className="wf-undo-toast" initial={{opacity:0,y:12,scale:.96}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:6,scale:.98}} transition={{type:"spring",stiffness:480,damping:36,mass:.65}}><span role="status">{entryKind(undo.word)==='sentence'?'Sentence deleted':'Word deleted'}</span><button type="button" disabled={busy||blocked||translating} onClick={()=>void restoreEntry()}>Undo</button><span className="wf-undo-count" aria-hidden="true"><motion.span key={undoSeconds} initial={{opacity:0,y:3}} animate={{opacity:1,y:0}} transition={{duration:.12}}>{undoSeconds}</motion.span></span><div className="wf-undo-track" aria-hidden="true"><motion.div initial={{scaleX:1}} animate={{scaleX:0}} transition={{duration:5,ease:'linear'}}/></div></motion.div>}</AnimatePresence></div>;
}
