import { useEffect, useState, useRef } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './services/supabase';
import { motion, MotionConfig, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Check, RefreshCw, ArrowLeft } from 'lucide-react';
import { OtpInput } from './features/auth/OtpInput';
import { Vocabulary } from './features/vocabulary/Vocabulary';

export function App() {
  const [theme,setTheme]=useState<'system'|'light'|'dark'>(()=>{try{const t=localStorage.getItem('wf-appearance');return t==='light'||t==='dark'?t:'system';}catch{return 'system';}});
  useEffect(()=>{document.documentElement.dataset.theme=theme;try{localStorage.setItem('wf-appearance',theme);}catch{}},[theme]);
  const [session,setSession]=useState<Session|null>(null);
  const [ready,setReady]=useState(false);
  const [startupError,setStartupError]=useState(false);
  const [startupAttempt,setStartupAttempt]=useState(0);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [showPassword,setShowPassword]=useState(false);
  const [signup,setSignup]=useState(()=>{try{return localStorage.getItem('wf-auth-visited')!=='1';}catch{return false;}});
  useEffect(()=>{try{localStorage.setItem('wf-auth-visited','1');}catch{}},[]);
  const [googleBusy,setGoogleBusy]=useState(false);
  const [notice,setNotice]=useState('');
  const [email,setEmail]=useState('');
  const [pendingEmail,setPendingEmail]=useState('');
  const [otp,setOtp]=useState('');
  const [offerSignup,setOfferSignup]=useState(false);
  const verifying=!!pendingEmail&&pendingEmail===email.trim();
  const verifyLock=useRef(false);
  async function verifyCode(e:FormEvent<HTMLFormElement>){e.preventDefault();if(verifyLock.current||busy||resendBusy||googleBusy||!verifying||!/^\d{6}$/.test(otp))return;verifyLock.current=true;setBusy(true);setError('');setNotice('');try{const {data,error}=await supabase.auth.verifyOtp({email:pendingEmail,token:otp,type:'email'});if(error)throw error;setOtp('');setPendingEmail('');if(!data.session){setSignup(false);setNotice('Email verified. Sign in.');}}catch{setError('Invalid or expired code.');}finally{verifyLock.current=false;setBusy(false);}}
  function switchMode(mode:boolean){setSignup(mode);setShowPassword(false);setError('');setNotice('');setOfferSignup(false);setOtp('');setPendingEmail('');}
  const [resendBusy,setResendBusy]=useState(false);
  const [resendAt,setResendAt]=useState(0);
  const [now,setNow]=useState(Date.now());
  const resendLock=useRef(false);
  const seconds=Math.max(0,Math.ceil((resendAt-now)/1000));
  useEffect(()=>{if(resendAt<=Date.now())return;const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[resendAt]);
  async function resendConfirmation(){if(resendLock.current||busy||googleBusy||!pendingEmail||email.trim()!==pendingEmail||Date.now()<resendAt)return;resendLock.current=true;setResendBusy(true);setError('');setNotice('');try{const {error}=await supabase.auth.resend({type:'signup',email:pendingEmail,options:{emailRedirectTo:redirectTo}});if(error)throw error;setOtp('');setNotice('New code requested.');}catch{setError('Could not resend. Try again shortly.');}finally{setResendAt(Date.now()+60000);setNow(Date.now());resendLock.current=false;setResendBusy(false);}}

  const redirectTo=new URL('./',window.location.href).href;
  async function googleSignIn(){setGoogleBusy(true);setError('');setNotice('');try{const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo}});if(error)throw error;}catch{setError('Could not connect to Google. Try again.');setGoogleBusy(false);}}
  useEffect(()=>{
    let active=true, resolved=false;
    setStartupError(false);
    const timer=window.setTimeout(()=>{if(active&&!resolved)setStartupError(true);},10000);
    const apply=(next:Session|null)=>{if(!active)return;resolved=true;window.clearTimeout(timer);setStartupError(false);setSession(next);setReady(true);if(next){setSignup(false);setPendingEmail('');setOtp('');setError('');setNotice('');setOfferSignup(false);setGoogleBusy(false);setShowPassword(false);}};
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>apply(next));
    void supabase.auth.getSession().then(({data,error})=>{if(!active||resolved)return;if(error){setStartupError(true);return;}apply(data.session);}).catch(()=>{if(active&&!resolved)setStartupError(true);});
    return ()=>{active=false;window.clearTimeout(timer);subscription.unsubscribe();};
  },[startupAttempt]);
  async function signIn(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy||resendBusy||googleBusy)return;setBusy(true);setError('');setNotice('');setOfferSignup(false);setShowPassword(false);
    const form=new FormData(event.currentTarget);
    try {const credentials={email:String(form.get('email')).trim(),password:String(form.get('password'))};const result=signup?await supabase.auth.signUp({...credentials,options:{emailRedirectTo:redirectTo}}):await supabase.auth.signInWithPassword(credentials);if(result.error)throw result.error;if(!result.data.session){setPendingEmail(credentials.email);setResendAt(Date.now()+60000);setNow(Date.now());setNotice('Enter the 6-digit code from your email.');}}
    catch(e){const code=typeof e==='object'&&e!==null&&'code' in e?String(e.code):'';if(code==='email_not_confirmed'){setPendingEmail(String(form.get('email')).trim());setOtp('');}if(code==='invalid_credentials'&&!signup)setOfferSignup(true);setError(code==='invalid_credentials'?'Incorrect email or password.':code==='email_not_confirmed'?'Verify your email.':code==='over_request_rate_limit'||code==='over_email_send_rate_limit'?'Too many requests. Try again later.':code==='signup_disabled'?'Sign up is unavailable.':!navigator.onLine?'You are offline.':'Unable to sign in. Try again.');}
    finally{setBusy(false);}
  }
  return <MotionConfig reducedMotion="user"><main className={ready&&!session?"wf-auth-shell":"wf-shell"}>
    {(!ready||session)&&<header className="wf-header"><a className="wf-brand" href="./"><img src="./icon.svg" width="38" height="38" alt=""/><span>WordFlow</span></a><span className="wf-header-caption">Personal vocabulary</span></header>}
    {session&&error&&<p role="alert" className="wf-error">{error}</p>}
    <AnimatePresence mode="wait" initial={false}>{!ready?<div key="loading" className="wf-panel mx-auto mt-8 grid gap-3" role="status">{startupError?<><strong>Connection taking too long.</strong><p className="text-sm">Your saved data has not been changed.</p><button className="wf-primary px-4" onClick={()=>{setStartupError(false);setStartupAttempt(n=>n+1);}}>Retry</button><button className="wf-action" onClick={()=>window.location.reload()}>Reload page</button></>:<><div className="wf-skeleton motion-safe:animate-pulse"/><p>Checking session…</p></>}</div>:!session?<motion.section key="auth" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.2}} className="wf-auth-body"><section className="wf-auth-story"><div className="wf-auth-brand"><img src="./icon.svg" alt=""/><span>WordFlow</span></div><div className="wf-auth-story-content"><span className="wf-auth-eyebrow">Your personal vocabulary space</span><h2>Make every word <span>count.</span></h2></div><div className="wf-auth-story-footer"><Check size={18}/><span>Your personal vocabulary, synced across devices.</span></div></section><section className="wf-auth-main"><div className="wf-auth-form"><div className="wf-auth-brand wf-auth-mobile-brand"><img src="./icon.svg" alt=""/><span>WordFlow</span></div><h1 style={{minHeight:'2.2em'}}>{verifying?'Verify your email.':signup?'Start your learning journey.':'Welcome back.'}</h1><div className="wf-auth-toggle" data-mode={signup?'signup':'login'} role="group" aria-label="Account access">{[false,true].map(mode=><button key={String(mode)} type="button" disabled={busy||googleBusy||resendBusy} aria-pressed={signup===mode} onClick={()=>switchMode(mode)}>{mode?'Sign up':'Sign in'}</button>)}</div><button type="button" disabled={busy||googleBusy||resendBusy} className="wf-google" onClick={googleSignIn}><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M43.61 24.46c0-1.36-.12-2.66-.35-3.92H24v7.43h11.02a9.42 9.42 0 0 1-4.09 6.19v5.14h6.63c3.88-3.57 6.05-8.82 6.05-14.84z"/><path fill="#34A853" d="M24 44c5.51 0 10.13-1.82 13.51-4.93l-6.63-5.14c-1.82 1.22-4.15 1.95-6.88 1.95-5.33 0-9.85-3.6-11.47-8.44H5.69v5.29A20 20 0 0 0 24 44z"/><path fill="#FBBC05" d="M12.53 27.44A12 12 0 0 1 12 24c0-1.2.19-2.36.53-3.44v-5.29H5.69a20 20 0 0 0 0 17.46z"/><path fill="#EA4335" d="M24 12.12c3.01 0 5.7 1.04 7.83 3.08l5.87-5.87C34.12 5.99 29.51 4 24 4A20 20 0 0 0 5.69 15.27l6.84 5.29C14.15 15.72 18.67 12.12 24 12.12z"/></svg><span>{googleBusy?(signup?'Signing up…':'Signing in…'):'Continue with Google'}</span></button><div className="wf-auth-divider">or</div>{verifying?<form onSubmit={verifyCode} className="wf-email-form" style={{minHeight:'205px'}}><p className="text-sm break-all">Enter the 6-digit code sent to {pendingEmail}.</p><label htmlFor="wf-otp">Verification code</label><OtpInput value={otp} onChange={v=>{setOtp(v);setError('');}} disabled={busy||resendBusy||googleBusy} error={!!error}/><button className="wf-email-submit" disabled={busy||resendBusy||googleBusy||otp.length!==6}>{busy?'Verifying…':'Verify email'}</button><div className="wf-auth-links"><button type="button" disabled={busy||resendBusy||googleBusy} onClick={()=>switchMode(signup)}><ArrowLeft size={14}/>Change email</button><button type="button" disabled={busy||googleBusy||resendBusy||seconds>0} onClick={()=>void resendConfirmation()}><RefreshCw size={14}/>{resendBusy?'Sending…':seconds>0?'Resend in '+seconds+'s':'Resend code'}</button></div></form>:<motion.form key={signup?'signup':'signin'} initial={{opacity:0}} animate={{opacity:1}} transition={{duration:.16}} onSubmit={signIn} className="wf-email-form"><label>Email<input id="wf-email" name="email" type="email" autoComplete="email" value={email} onChange={e=>{setEmail(e.target.value);setPendingEmail('');setOtp('');setOfferSignup(false);setError('');setNotice('');}} disabled={busy||resendBusy||googleBusy} required/></label><div className="grid gap-1"><label htmlFor="wf-password">Password</label><div className="wf-auth-password"><input id="wf-password" name="password" type={showPassword?'text':'password'} autoComplete={signup?'new-password':'current-password'} minLength={signup?8:undefined} required/><button type="button" aria-label={showPassword?'Hide password':'Show password'} aria-controls="wf-password" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></div><button className="wf-email-submit" disabled={busy||googleBusy}>{busy?(signup?'Creating account…':'Signing in…'):(signup?'Sign up':'Sign in')}</button><div className="wf-auth-links"><button type="button" disabled={busy||resendBusy||googleBusy||!email.trim()} onClick={()=>{setEmail('');setOtp('');setPendingEmail('');setError('');setNotice('');setOfferSignup(false);document.getElementById('wf-email')?.focus();}}>Reset email</button><button type="button" disabled={busy||resendBusy||googleBusy} onClick={()=>switchMode(!signup)}>{signup?'Already registered? Sign in':'New here? Sign up'}</button></div></motion.form>}<div className="wf-auth-feedback" style={{height:"9rem",overflowY:"auto",minWidth:0}} aria-live="polite" aria-atomic="true">{error?<p className="wf-error">{error}{offerSignup&&!verifying&&<span className="block mt-1 text-xs">New here? <button type="button" className="font-semibold underline" onClick={()=>switchMode(true)}>Sign up</button> · Or use Google.</span>}</p>:notice?<p className="text-sm">{notice}</p>:null}</div></div></section></motion.section>:<motion.div key={session.user.id} initial={{opacity:0,y:5}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.2}}><Vocabulary userId={session.user.id} user={session.user} theme={theme} setTheme={setTheme} signOut={async()=>{const {error}=await supabase.auth.signOut({scope:"local"});if(error)setError("Could not sign out.");}}/></motion.div>}</AnimatePresence>
  </main></MotionConfig>;
}
