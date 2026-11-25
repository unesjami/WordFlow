let request=0;let timer:ReturnType<typeof setTimeout>|undefined;let active:SpeechSynthesisUtterance|null=null;
export function stopSpeech(){request++;clearTimeout(timer);active=null;if(typeof window!=='undefined')window.speechSynthesis?.cancel();}
export function speakEnglish(text:string,onError:(message:string)=>void=()=>{}){
 const value=text.trim();if(!value)return;
 const synth=window.speechSynthesis;
 if(!synth||typeof SpeechSynthesisUtterance==='undefined'){onError('Pronunciation unavailable in this browser.');return;}
 stopSpeech();const id=request;if(synth.paused)synth.resume();
 const voices=synth.getVoices().filter(v=>/^en(?:-|$)/i.test(v.lang));
 const score=(v:SpeechSynthesisVoice)=>(/natural|neural|premium|enhanced/i.test(v.name)?100:0)+(v.localService?80:0)+(/^en-us$/i.test(v.lang)?15:0)+(/google/i.test(v.name)?60:0)-(/compact|espeak|robot/i.test(v.name)?35:0);
 const preferred=[...voices].sort((a,b)=>score(b)-score(a))[0];const local=voices.find(v=>v.localService&&/^en-us$/i.test(v.lang))??voices.find(v=>v.localService);
 let retried=false;
 function play(voice?:SpeechSynthesisVoice){
  if(id!==request)return;
  const utterance=new SpeechSynthesisUtterance(value);utterance.lang=voice?.lang??'en-US';if(voice)utterance.voice=voice;utterance.rate=.97;active=utterance;
  const current=()=>id===request&&active===utterance;
  const fallback=()=>{if(!current())return;clearTimeout(timer);active=null;if(retried){onError('Voice unavailable. Check your speech settings.');return;}retried=true;synth.cancel();play(local!==voice?local:undefined);};
  utterance.onstart=()=>{if(current())clearTimeout(timer);};
  utterance.onend=()=>{if(current()){clearTimeout(timer);active=null;}};
  utterance.onerror=fallback;timer=setTimeout(fallback,1400);
  try{synth.speak(utterance);}catch{fallback();}
 }
 play(preferred);
}
