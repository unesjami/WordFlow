import { supabase } from './supabase';
import { parseLegacyWords } from '../domain';
export async function readWorkspace(userId:string) { const {data,error}=await supabase.from('wordflow_workspaces').select('words,preferences,revision').eq('user_id',userId).maybeSingle(); if(error) throw error; if(!data) return null; return {words:parseLegacyWords(JSON.stringify(data.words)),preferences:data.preferences,revision:data.revision}; }

export async function writeWorkspace(userId:string,words:import('../domain').Word[],revision:number|null):Promise<number>{
  const {data:{user},error:authError}=await supabase.auth.getUser();
  if(authError||user?.id!==userId)throw new Error('Session changed. Sign in again.');
  if(revision===null){
    const {data,error}=await supabase.from('wordflow_workspaces').insert({user_id:userId,words,revision:1}).select('revision').single();
    if(error||!data)throw new Error('Could not create workspace. Reload before trying again.');
    return data.revision;
  }
  const {data,error}=await supabase.from('wordflow_workspaces').update({words,revision:revision+1,updated_at:new Date().toISOString()}).eq('user_id',userId).eq('revision',revision).select('revision').maybeSingle();
  if(error||!data)throw new Error('Save failed or workspace changed on another device. Reload before retrying.');
  return data.revision;
}
