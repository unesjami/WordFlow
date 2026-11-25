import { createClient } from '@supabase/supabase-js';
// Public project credentials only; authorization is enforced by database RLS.
export const supabase = createClient('https://wstxoeebgvkmlkpefcot.supabase.co', 'sb_publishable_97JMqvFbbwJgBMPmZgXMJw_pSV6nVtU', {auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
