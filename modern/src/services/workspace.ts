import { supabase } from './supabase';
import { parseLegacyWords } from '../domain';
export async function readWorkspace(userId:string) { const {data,error}=await supabase.from('wordflow_workspaces').select('words,preferences,revision').eq('user_id',userId).maybeSingle(); if(error) throw error; if(!data) return null; return {words:parseLegacyWords(JSON.stringify(data.words)),preferences:data.preferences,revision:data.revision}; }
