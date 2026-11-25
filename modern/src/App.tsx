import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './services/supabase';
import { motion, MotionConfig } from 'motion/react';
import { LogOut, Mail, LockKeyhole, ArrowRight, Sun, Moon, Monitor } from 'lucide-react';
import { Vocabulary } from './features/vocabulary/Vocabulary';

export function App() {
  const [theme,setTheme]=useState<'system'|'light'|'dark'>(()=>{try{const t=localStorage.getItem('wf-appearance');return t==='light'||t==='dark'?t:'system';}catch{return 'system';}});
  useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('wf-appearance',theme);}catch{}},[theme]);
  const [session,setSession]=useState<Session|null>(null);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{
      if(active){setSession(next);setReady(true);}
    });
    return ()=>{active=false;subscription.unsubscribe();};
  },[]);
  async function signIn(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');
    const form=new FormData(event.currentTarget);
    try {const {error}=await supabase.auth.signInWithPassword({email:String(form.get('email')),password:String(form.get('password'))});if(error)throw error;}
    catch{setError('Sign-in failed. Check your credentials and connection.');}
    finally{setBusy(false);}
  }
  return <MotionConfig reducedMotion="user"><main className="wf-shell">
    <header className="wf-header"><a className="wf-brand" href="./"><img src="./icon.svg" width="38" height="38" alt=""/><span>WordFlow</span></a><div className="flex items-center gap-2"><div className="wf-theme" aria-label="Appearance">{([{value:'light',Icon:Sun},{value:'dark',Icon:Moon},{value:'system',Icon:Monitor}] as const).map(({value,Icon})=><button key={value} type="button" aria-label={value+' theme'} aria-pressed={theme===value} onClick={()=>setTheme(value)}><Icon size={17}/></button>)}</div>{session&&<button title="Sign out" aria-label="Sign out" className="wf-icon" onClick={async()=>{const {error}=await supabase.auth.signOut({scope:'local'});if(error)setError('Could not sign out.');}}><LogOut size={19}/></button>}</div></header>
    {error&&<p role="alert" className="wf-error">{error}</p>}
    {!ready?<div role="status" className="wf-skeleton motion-safe:animate-pulse"><span className="sr-only">Checking session</span></div>:!session?<motion.section initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="wf-login"><img src="./icon.svg" width="76" height="76" alt=""/><h1>Welcome to WordFlow</h1><form onSubmit={signIn} className="grid gap-4"><label className="grid gap-2">Email<div className="wf-field"><Mail size={18}/><input name="email" type="email" autoComplete="email" required/></div></label><label className="grid gap-2">Password<div className="wf-field"><LockKeyhole size={18}/><input name="password" type="password" autoComplete="current-password" required/></div></label><button className="wf-primary" disabled={busy}>{busy?'Signing in…':'Sign in'}<ArrowRight size={18}/></button></form></motion.section>:<Vocabulary key={session.user.id} userId={session.user.id} user={session.user}/>}
  </main></MotionConfig>;
}
