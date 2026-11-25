let request=0;let timer:ReturnType<typeof setTimeout>|undefined;let active:SpeechSynthesisUtterance|null=null;
const quality=/natural|neural|premium|enhanced|google.*english/i;
const unwanted=/compact|espeak|robot|microsoft david|microsoft mark|google uk english male/i;
export function preferredVoices(voices:SpeechSynthesisVoice[]){
 return voices.filter(v=>/^en(?:-|$)/i.test(v.lang)&&quality.test(v.name)&&!unwanted.test(v.name)).sort((a,b)=>score(b)-score(a));
}
function score(v:SpeechSynthesisVoice){return (/female|aria|jenny|sonia|libby|ava|emma|michelle|samantha/i.test(v.name)?400:0)+(/natural|neural/i.test(v.name)?200:0)+(/^en-us$/i.test(v.lang)?40:0)+(/google/i.test(v.name)?20:0);}
export function stopSpeech(){request++;clearTimeout(timer);active=null;if(typeof window!=='undefined')window.speechSynthesis?.cancel();}
if(typeof window!=='undefined')window.speechSynthesis?.getVoices();
export function speakEnglish(text:string,onError:(message:string)=>void=()=>{}){
 const value=text.trim();if(!value)return;
 const synth=window.speechSynthesis;
 if(!synth||typeof SpeechSynthesisUtterance==='undefined'){onError('Pronunciation unavailable in this browser.');return;}
 stopSpeech();const id=request;if(synth.paused)synth.resume();
 const start=()=>{if(id!==request)return;const voices=preferredVoices(synth.getVoices());if(!voices.length){onError('Natural English voice unavailable. Try a browser with enhanced English voices.');return;}
 let index=0;
 function play(){if(id!==request)return;const voice=voices[index++];if(!voice){onError('Natural pronunciation unavailable. Try again.');return;}const utterance=new SpeechSynthesisUtterance(value);utterance.lang=voice.lang;utterance.voice=voice;utterance.rate=.96;utterance.pitch=1;active=utterance;
 const current=()=>id===request&&active===utterance;
 const fallback=()=>{if(!current())return;clearTimeout(timer);active=null;synth.cancel();play();};
 utterance.onstart=()=>{if(current())clearTimeout(timer);};utterance.onend=()=>{if(current()){clearTimeout(timer);active=null;}};utterance.onerror=fallback;timer=setTimeout(fallback,3500);
 try{synth.speak(utterance);}catch{fallback();}
 }play();};
 if(synth.getVoices().length)start();else timer=setTimeout(start,500);
}
