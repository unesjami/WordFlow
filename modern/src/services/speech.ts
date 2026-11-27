export type SpeechPhase='idle'|'loading'|'playing';
let phase:SpeechPhase='idle',owner:string|null=null;
const listeners=new Set<()=>void>();
let state: {phase:SpeechPhase;owner:string|null}={phase,owner};
export function getSpeechState(){return state;}
export function subscribeSpeech(fn:()=>void){listeners.add(fn);return ()=>{listeners.delete(fn);};}
function publish(next:SpeechPhase,key:string|null){phase=next;owner=key;state={phase,owner};listeners.forEach(fn=>fn());}
let audio:HTMLAudioElement|null=null;let lookup:AbortController|null=null;const urls=new Map<string,string[]>();const successfulAudio=new Map<string,string>();
let request=0;let timer:ReturnType<typeof setTimeout>|undefined;let active:SpeechSynthesisUtterance|null=null;
const quality=/natural|neural|premium|enhanced|google.*english/i;
const unwanted=/compact|espeak|robot|microsoft david|microsoft mark|google uk english male/i;
export function preferredVoices(voices:SpeechSynthesisVoice[]){
 return voices.filter(v=>/^en(?:-|$)/i.test(v.lang)&&quality.test(v.name)&&!unwanted.test(v.name)).sort((a,b)=>score(b)-score(a));
}
function score(v:SpeechSynthesisVoice){return (/natural|neural/i.test(v.name)?200:0)+(/^en-us$/i.test(v.lang)?40:0)+(/google/i.test(v.name)?20:0);}
export function stopSpeech(){request++;clearTimeout(timer);lookup?.abort();lookup=null;if(audio){audio.pause();audio.removeAttribute('src');audio.load();audio=null;}active=null;publish('idle',null);if(typeof window!=='undefined')window.speechSynthesis?.cancel();}
if(typeof window!=='undefined')window.speechSynthesis?.getVoices();
async function dictionaryAudio(value:string,signal:AbortSignal):Promise<string[]>{
 if(!/^[a-z]+(?:['’-][a-z]+)*$/i.test(value))return [];
 const word=value.toLowerCase();const cached=urls.get(word);if(cached)return [...cached];
 const response=await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(word),{signal});
 if(!response.ok)return [];
 const entries=await response.json() as {phonetics?:{audio?:string}[]}[];
 if(!Array.isArray(entries))return [];
 const result=[...new Set(entries.flatMap(e=>(e.phonetics??[]).map(p=>p.audio??'')).map(u=>u.startsWith('//')?'https:'+u:u).filter(u=>{try{const parsed=new URL(u);return parsed.protocol==='https:'&&['api.dictionaryapi.dev','ssl.gstatic.com','upload.wikimedia.org','commons.wikimedia.org'].includes(parsed.hostname);}catch{return false;}}))];
 if(result.length){if(urls.size>=200)urls.delete(urls.keys().next().value!);urls.set(word,result);}
 return [...result];
}
export function speakEnglish(text:string,onError:(message:string)=>void=()=>{},key:string|null=null){
 const value=text.trim();if(!value)return;
 stopSpeech();const id=request;publish('loading',key);
 const synth=window.speechSynthesis;
 const fail=()=>{if(id!==request)return;stopSpeech();onError('Audio temporarily unavailable');};
 const recorded=async()=>{
  if(id!==request)return;
  publish('loading',key);const controller=new AbortController();lookup=controller;
  const timeout=setTimeout(()=>controller.abort(),5000);
  let candidates:string[]=[];
  try{candidates=await dictionaryAudio(value,controller.signal);}catch{}finally{clearTimeout(timeout);if(lookup===controller)lookup=null;}
  if(id!==request)return;
  const remembered=successfulAudio.get(value.toLowerCase());if(remembered)candidates=[remembered,...candidates.filter(u=>u!==remembered)];
  const playNext=()=>{
   if(id!==request)return;
   const url=candidates.shift();if(!url){browser();return;}
   const player=new Audio(url);audio=player;
   const current=()=>id===request&&audio===player;
   const fallback=()=>{if(!current())return;clearTimeout(timer);audio=null;player.pause();player.removeAttribute('src');player.load();playNext();};
   player.onplaying=()=>{if(current()){if(successfulAudio.size>=200)successfulAudio.delete(successfulAudio.keys().next().value!);successfulAudio.set(value.toLowerCase(),url);clearTimeout(timer);publish('playing',key);timer=setTimeout(fallback,30000);}};
   player.onended=()=>{if(current()){clearTimeout(timer);audio=null;publish('idle',null);}};
   player.onerror=fallback;timer=setTimeout(fallback,5000);
   void player.play().catch(fallback);
  };playNext();
 };
 const browser=()=>{
 if(!synth||typeof SpeechSynthesisUtterance==='undefined'){fail();return;}
 if(synth.paused)synth.resume();
 const start=()=>{if(id!==request)return;const voices=preferredVoices(synth.getVoices());let index=0;
 function play(){if(id!==request)return;const voice=voices[index++];if(!voice){fail();return;}const utterance=new SpeechSynthesisUtterance(value);utterance.lang=voice.lang;utterance.voice=voice;utterance.rate=.96;utterance.pitch=1;active=utterance;
 const current=()=>id===request&&active===utterance;
 const fallback=()=>{if(!current())return;clearTimeout(timer);active=null;publish('loading',key);synth.cancel();play();};
 utterance.onstart=()=>{if(current()){clearTimeout(timer);publish('playing',key);timer=setTimeout(()=>{if(current())fallback();},Math.min(90000,Math.max(12000,value.length*180)));}};utterance.onend=()=>{if(current()){clearTimeout(timer);active=null;publish('idle',null);}};utterance.onerror=fallback;timer=setTimeout(fallback,3500);
 try{synth.speak(utterance);}catch{fallback();}
 }play();};
 if(synth.getVoices().length)start();else timer=setTimeout(start,500);
 };
 void recorded();
}
