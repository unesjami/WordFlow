import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './services/supabase';
import { readWorkspace } from './services/workspace';
import type { Word } from './domain';

export function App() {
  const [session,setSession]=useState<Session|null>(null);
  const [ready,setReady]=useState(false);
  const [words,setWords]=useState<Word[]|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{
      if(active){setSession(next);setReady(true);}
    });
    return ()=>{active=false;subscription.unsubscribe();};
  },[]);
  const userId=session?.user.id;
  useEffect(()=>{
    let active=true;
    setWords(null);setError('');
    if(userId) readWorkspace(userId).then(result=>{if(active)setWords(result?.words??[]);}).catch(()=>{if(active)setError('Could not load your vocabulary. Your saved data has not been changed.');});
    return ()=>{active=false;};
  },[userId]);
  async function signIn(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('');
    const form=new FormData(event.currentTarget);
    try {const {error}=await supabase.auth.signInWithPassword({email:String(form.get('email')),password:String(form.get('password'))});if(error)throw error;}
    catch{setError('Sign-in failed. Check your credentials and connection.');}
    finally{setBusy(false);}
  }
  return <main className="mx-auto min-h-screen max-w-2xl p-8">
    <header className="mb-8 flex items-center justify-between"><h1 className="text-3xl font-bold tracking-tight">WordFlow</h1>{session&&<button className="rounded-lg border px-4 py-2" onClick={async()=>{const {error}=await supabase.auth.signOut({scope:'local'});if(error)setError('Could not sign out.');}}>Sign out</button>}</header>
    <p className="mb-5 text-sm opacity-75">Development preview · Read-only vocabulary</p>
    {error&&<p role="alert" className="mb-4 rounded-lg border border-red-500 p-3">{error}</p>}
    {!ready?<div role="status" className="space-y-3 motion-safe:animate-pulse"><span className="sr-only">Checking session</span><div className="h-12 rounded-xl bg-current opacity-10"/><div className="h-24 rounded-xl bg-current opacity-10"/></div>:!session?<form onSubmit={signIn} className="grid gap-4"><label className="grid gap-1">Email<input className="rounded-lg border p-3" name="email" type="email" autoComplete="email" required/></label><label className="grid gap-1">Password<input className="rounded-lg border p-3" name="password" type="password" autoComplete="current-password" required/></label><button className="rounded-lg bg-teal-700 p-3 text-white disabled:opacity-50" disabled={busy}>{busy?'Signing in…':'Sign in'}</button></form>:words===null?<p role="status">{error?'Vocabulary unavailable':'Loading vocabulary…'}</p>:<section><h2 className="mb-4 text-xl font-semibold">Vocabulary · {words.length}</h2>{words.length===0?<p>No saved words.</p>:<ul className="divide-y divide-current/10">{words.map((word,i)=><li key={i} className="flex justify-between gap-4 py-3"><span>{word.en}</span><span lang="fa" dir="rtl">{word.fa}</span></li>)}</ul>}</section>}
  </main>;
}
