import {useId,useSyncExternalStore} from 'react';
import {Volume2,LoaderCircle,AudioLines} from 'lucide-react';
import {getSpeechState,subscribeSpeech,speakEnglish,stopSpeech} from '../../services/speech';
export function PronounceButton({text,onError,label,showLabel=false}:{text:string;onError:(message:string)=>void;label?:string;showLabel?:boolean}){
 const id=useId(),state=useSyncExternalStore(subscribeSpeech,getSpeechState);
 const phase=state.owner===id?state.phase:'idle';
 const title=phase==='loading'?'Preparing audio':phase==='playing'?'Stop pronunciation':label??'Pronounce';
 return <button type="button" className="wf-action wf-pronounce" data-phase={phase} aria-label={title} aria-busy={phase==='loading'} title={title} onClick={()=>phase==='idle'?speakEnglish(text,onError,id):stopSpeech()}>
 {phase==='loading'?<LoaderCircle size={18} className="wf-pronounce-spinner"/>:phase==='playing'?<AudioLines size={18} className="wf-pronounce-wave"/>:<Volume2 size={18}/>}
 {showLabel&&<span>{phase==='loading'?'Preparing…':phase==='playing'?'Playing…':'Play pronunciation'}</span>}
 </button>;
}
