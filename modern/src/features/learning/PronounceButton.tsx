import {useId,useSyncExternalStore,useState,useEffect} from 'react';
import {Volume2,LoaderCircle,AudioLines} from 'lucide-react';
import {getSpeechState,subscribeSpeech,speakEnglish,stopSpeech} from '../../services/speech';
export function PronounceButton({text,onError,label,showLabel=false}:{text:string;onError:(message:string)=>void;label?:string;showLabel?:boolean}){
 const [failed,setFailed]=useState(false);
 useEffect(()=>{setFailed(false);},[text]);
 const id=useId(),state=useSyncExternalStore(subscribeSpeech,getSpeechState);
 const phase=state.owner===id?state.phase:'idle';
 const title=phase==='loading'?'Preparing audio':phase==='playing'?'Stop pronunciation':failed?'Retry pronunciation':label??'Pronounce';
 return <button type="button" className="wf-action wf-pronounce" data-phase={phase} data-failed={failed} aria-label={title} aria-busy={phase==='loading'} title={title} onClick={()=>{if(phase==='idle'){setFailed(false);speakEnglish(text,()=>setFailed(true),id);}else stopSpeech();}}>
 {phase==='loading'?<LoaderCircle size={18} className="wf-pronounce-spinner"/>:phase==='playing'?<AudioLines size={18} className="wf-pronounce-wave"/>:<Volume2 size={18}/>}
 {showLabel&&<span>{phase==='loading'?'Preparing…':phase==='playing'?'Playing…' :failed?'Retry pronunciation':'Play pronunciation'}</span>}
 </button>;
}
