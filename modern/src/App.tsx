import { useEffect, useState, useRef } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './services/supabase';
import { motion, MotionConfig } from 'motion/react';
import { LogOut, Sun, Moon, Monitor, Eye, EyeOff, Check } from 'lucide-react';
import { Vocabulary } from './features/vocabulary/Vocabulary';

export function App() {
  const [theme,setTheme]=useState<'system'|'light'|'dark'>(()=>{try{const t=localStorage.getItem('wf-appearance');return t==='light'||t==='dark'?t:'system';}catch{return 'system';}});
  useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('wf-appearance',theme);}catch{}},[theme]);
  const [session,setSession]=useState<Session|null>(null);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const [signup,setSignup]=useState(false);
  const [googleBusy,setGoogleBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [email,setEmail]=useState('');
  const [pendingEmail,setPendingEmail]=useState('');
  const [resendBusy,setResendBusy]=useState(false);
  const [resendAt,setResendAt]=useState(0);
  const [now,setNow]=useState(Date.now());
  const resendLock=useRef(false);
  const seconds=Math.max(0,Math.ceil((resendAt-now)/1000));
  useEffect(()=>{if(resendAt<=Date.now())return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[resendAt]);
  async function resendConfirmation(){if(resendLock.current||busy||googleBusy||!pendingEmail||email.trim()!==pendingEmail||Date.now()<resendAt)return;resendLock.current=true;setResendBusy(true);setError('');setNotice('');try{const {error}=await supabase.auth.resend({type:'signup',email:pendingEmail,options:{emailRedirectTo:redirectTo}});if(error)throw error;setNotice('If confirmation is needed, a new email has been requested. Check your inbox and spam folder.');}catch{setError('Could not resend right now. Check your inbox or try again after the cooldown.');}finally{setResendAt(Date.now()+60000);setNow(Date.now());resendLock.current=false;setResendBusy(false);}}

  const redirectTo=new URL('./',window.location.href).href;
  async function googleSignIn(){setGoogleBusy(true);setError('');setNotice('');try{const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo}});if(error)throw error;}catch{setError('Could not connect to Google. Try again.');setGoogleBusy(false);}}
  useEffect(()=>{
    let active=true;
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{
      if(active){setSession(next);setReady(true);}
    });
    return ()=>{active=false;subscription.unsubscribe();};
  },[]);
  async function signIn(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');setNotice('');setShowPassword(false);
    const form=new FormData(event.currentTarget);
    try {const credentials={email:String(form.get('email')).trim(),password:String(form.get('password'))};const result=signup?await supabase.auth.signUp({...credentials,options:{emailRedirectTo:redirectTo}}):await supabase.auth.signInWithPassword(credentials);if(result.error)throw result.error;if(!result.data.session){setPendingEmail(credentials.email);setResendAt(Date.now()+60000);setNow(Date.now());setNotice('Check your inbox and spam folder for the confirmation link. Then sign in.');}}
    catch(e){const code=typeof e==='object'&&e!==null&&'code' in e?String(e.code):'';if(code==='email_not_confirmed'){setPendingEmail(String(form.get('email')).trim());}setError(code==='invalid_credentials'?'Email or password is incorrect. If you registered with Google, use Continue with Google.':code==='email_not_confirmed'?'Confirm your email before signing in.':code==='over_request_rate_limit'||code==='over_email_send_rate_limit'?'Too many requests. Please try again later.':code==='signup_disabled'?'Account registration is currently unavailable.':!navigator.onLine?'You are offline. Connect to the internet and try again.':'Unable to connect or authenticate. Please try again.');}
    finally{setBusy(false);}
  }
  return <MotionConfig reducedMotion="user"><main className={ready&&!session?"wf-auth-shell":"wf-shell"}>
    {(!ready||session)&&<header className="wf-header"><a className="wf-brand" href="./"><img src="./icon.svg" width="38" height="38" alt=""/><span>WordFlow</span></a><div className="flex items-center gap-2"><div className="wf-theme" aria-label="Appearance">{([{value:'light',Icon:Sun},{value:'dark',Icon:Moon},{value:'system',Icon:Monitor}] as const).map(({value,Icon})=><button key={value} type="button" aria-label={value+' theme'} aria-pressed={theme===value} onClick={()=>setTheme(value)}><Icon size={17}/></button>)}</div>{session&&<button title="Sign out" aria-label="Sign out" className="wf-icon" onClick={async()=>{const {error}=await supabase.auth.signOut({scope:'local'});if(error)setError('Could not sign out.');}}><LogOut size={19}/></button>}</div></header>}
    {session&&error&&<p role="alert" className="wf-error">{error}</p>}
    {!ready?<div role="status" className="wf-skeleton motion-safe:animate-pulse"><span className="sr-only">Checking session</span></div>:!session?<motion.section initial={{opacity:0}} animate={{opacity:1}} className="wf-auth-body"><section className="wf-auth-story"><div className="wf-auth-brand"><img src="./icon.svg" alt=""/><span>WordFlow</span></div><div className="wf-auth-story-content"><span className="wf-auth-eyebrow">Your personal vocabulary space</span><h2>Make every word <span>count.</span></h2></div><div className="wf-auth-story-footer"><Check size={18}/><span>Your personal vocabulary, synced across devices.</span></div></section><section className="wf-auth-main"><div className="wf-auth-form"><div className="wf-auth-brand wf-auth-mobile-brand"><img src="./icon.svg" alt=""/><span>WordFlow</span></div><h1>{signup?'Start your learning journey.':'Welcome back.'}</h1><div className="wf-auth-toggle" data-mode={signup?'signup':'login'} role="group" aria-label="Account access">{[false,true].map(mode=><button key={String(mode)} type="button" disabled={busy||googleBusy||resendBusy} aria-pressed={signup===mode} onClick={()=>{setSignup(mode);setShowPassword(false);setError('');setNotice('');}}>{mode?'Sign up':'Sign in'}</button>)}</div><button type="button" disabled={busy||googleBusy} className="wf-google" onClick={googleSignIn}><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.43h11.02a9.42 9.42 0 0 1-4.09 6.19v5.14h6.63c3.88-3.57 6.05-8.82 6.05-14.84z"/><path fill="#34A853" d="M24 44c5.51 0 10.13-1.82 13.51-4.93l-6.63-5.14c-1.82 1.22-4.15 1.95-6.88 1.95-5.33 0-9.85-3.6-11.47-8.44H5.69v5.29A20 20 0 0 0 24 44z"/><path fill="#FBBC05" d="M12.53 27.44A12 12 0 0 1 12 24c0-1.2.19-2.36.53-3.44v-5.29H5.69a20 20 0 0 0 0 17.46z"/><path fill="#EA4335" d="M24 12.12c3.01 0 5.7 1.04 7.83 3.08l5.87-5.87C34.12 5.99 29.51 4 24 4A20 20 0 0 0 5.69 15.27l6.84 5.29C14.15 15.72 18.67 12.12 24 12.12z"/></svg><span>{googleBusy?'Connecting…':'Continue with Google'}</span></button><div className="wf-auth-divider">or</div><form onSubmit={signIn} className="wf-email-form"><label>Email<input name="email" type="email" autoComplete="email" value={email} onChange={e=>{setEmail(e.target.value);setPendingEmail('');setError('');setNotice('');}} required/></label><div className="grid gap-1"><label htmlFor="wf-password">Password</label><div className="wf-auth-password"><input id="wf-password" name="password" type={showPassword?'text':'password'} autoComplete={signup?'new-password':'current-password'} minLength={signup?8:undefined} required/><button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-controls="wf-password" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></div><button className="wf-email-submit" disabled={busy||googleBusy}>{busy?(signup?'Creating account…':'Signing in…'):(signup?'Sign up':'Sign in')}</button></form><div className="wf-auth-feedback" style={{height:"9rem",overflowY:"auto",minWidth:0}} aria-live="polite" aria-atomic="true">{error?<p className="wf-error">{error}</p>:notice?<p className="text-sm">{notice}</p>:null}{pendingEmail&&email.trim()===pendingEmail&&<button type="button" className="wf-action mt-2" disabled={busy||googleBusy||resendBusy||seconds>0} onClick={()=>void resendConfirmation()}>{resendBusy?'Requesting…':seconds>0?'Resend in '+seconds+'s':'Resend confirmation email'}</button>}</div></div></section></motion.section>:<Vocabulary key={session.user.id} userId={session.user.id} user={session.user}/>}
  </main></MotionConfig>;
}
